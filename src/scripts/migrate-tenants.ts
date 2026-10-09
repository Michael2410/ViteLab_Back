import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { masterDb, masterTenants } from '../db/master';
import { inArray, eq } from 'drizzle-orm';

dotenv.config();

interface MigrationFile {
  version: string;
  filename: string;
  filePath: string;
  checksum: string;
  sqlContent: string;
  noTransaction: boolean;
}

const ADVISORY_LOCK_ID = 884920482; // Llave única para advisory lock en Master

// Parse CLI flags
const args = process.argv.slice(2);
const flagTenant = args.find((a) => a.startsWith('--tenant='))?.split('=')[1];
const isDryRun = args.includes('--dry-run');
const isContinueOnError = args.includes('--continue-on-error');
const isBaseline = args.includes('--baseline');
const baselineUpTo = args.find((a) => a.startsWith('--baseline-up-to='))?.split('=')[1];
const isStatusOnly = args.includes('--status');

function getMigrationFiles(): MigrationFile[] {
  const updatesDir = path.join(__dirname, '../../update BD');
  const files = fs
    .readdirSync(updatesDir)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();

  return files.map((filename) => {
    const filePath = path.join(updatesDir, filename);
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sqlContent, 'utf8').digest('hex');
    const noTransaction = sqlContent.includes('-- migrate:no-transaction');

    return {
      version: filename,
      filename,
      filePath,
      checksum,
      sqlContent,
      noTransaction,
    };
  });
}

async function runTenantMigrations() {
  console.log('====================================================');
  console.log('🚀 VITELAB - RUNNER DE MIGRACIONES MULTI-TENANT');
  console.log('====================================================');
  if (isDryRun) console.log('🔍 MODO DRY-RUN ACTIVADO (No se aplicarán cambios)');
  if (isBaseline) console.log('📌 MODO BASELINE ACTIVADO (Se registrarán sin ejecutar)');
  if (isStatusOnly) console.log('📊 MODO STATUS ACTIVADO (Consulta de estado)');

  // 1. Obtener Advisory Lock en Master
  const masterClient = new Client({
    host: process.env.MASTER_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.MASTER_DB_PORT || process.env.DB_PORT || '5432', 10),
    database: process.env.MASTER_DB_NAME || 'vitelab_master',
    user: process.env.MASTER_DB_USER || process.env.DB_USER || 'fcsadmin',
    password: process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
  });

  await masterClient.connect();

  const lockRes = await masterClient.query(
    'SELECT pg_try_advisory_lock($1) AS acquired',
    [ADVISORY_LOCK_ID]
  );

  if (!lockRes.rows[0].acquired) {
    console.error('❌ No se pudo adquirir el Advisory Lock en Master. Hay otra migración en curso.');
    await masterClient.end();
    process.exit(1);
  }

  console.log('🔒 Advisory lock global adquirido en Master.');

  try {
    // 2. Obtener lista de tenants a migrar
    let tenantsQuery = masterDb
      .select({
        id: masterTenants.id,
        slug: masterTenants.slug,
        databaseName: masterTenants.database_name,
        dbCluster: masterTenants.db_cluster,
        status: masterTenants.status,
      })
      .from(masterTenants);

    let tenantsList = await tenantsQuery;

    // Filtrar activos y suspendidos (según GUIA-AGENTE regla 25.3)
    tenantsList = tenantsList.filter(
      (t) => t.status === 'ACTIVE' || t.status === 'SUSPENDED'
    );

    if (flagTenant) {
      tenantsList = tenantsList.filter((t) => t.slug === flagTenant);
      if (tenantsList.length === 0) {
        console.error(`❌ Tenant con slug "${flagTenant}" no encontrado o no está ACTIVE/SUSPENDED.`);
        return;
      }
    }

    console.log(`📋 Tenants objetivo (${tenantsList.length}): ${tenantsList.map((t) => `${t.slug} [${t.status}]`).join(', ')}`);

    const migrationFiles = getMigrationFiles();
    console.log(`📁 Total de migraciones en repositorio: ${migrationFiles.length}`);

    const summary: { tenant: string; applied: number; skipped: number; failed: boolean; error?: string }[] = [];

    // 3. Iterar cada tenant
    for (const tenant of tenantsList) {
      console.log(`\n----------------------------------------------------`);
      console.log(`🏢 Procesando Tenant: ${tenant.slug} (${tenant.databaseName})`);
      console.log(`----------------------------------------------------`);

      const tenantClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: tenant.databaseName,
        user: process.env.DB_USER || 'fcsadmin',
        password: process.env.DB_PASSWORD,
      });

      let tenantSummary = {
        tenant: tenant.slug,
        applied: 0,
        skipped: 0,
        failed: false,
        error: undefined as string | undefined,
      };

      try {
        await tenantClient.connect();

        // Asegurar tabla schema_migrations
        await tenantClient.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version      VARCHAR(100) PRIMARY KEY,
            checksum     CHAR(64)     NOT NULL,
            applied_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
            duration_ms  INTEGER
          );
        `);

        // Obtener migraciones ya aplicadas
        const appliedRes = await tenantClient.query(
          'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version'
        );
        const appliedMap = new Map<string, { checksum: string; applied_at: Date }>();
        for (const row of appliedRes.rows) {
          appliedMap.set(row.version, { checksum: row.checksum, applied_at: row.applied_at });
        }

        if (isStatusOnly) {
          console.log(`Estado de migraciones para ${tenant.slug}:`);
          for (const mf of migrationFiles) {
            const status = appliedMap.has(mf.version) ? '✅ APLICADA' : '⏳ PENDIENTE';
            console.log(`  ${status} | ${mf.version}`);
          }
          await tenantClient.end();
          continue;
        }

        for (const mf of migrationFiles) {
          if (appliedMap.has(mf.version)) {
            const recorded = appliedMap.get(mf.version)!;
            if (recorded.checksum !== mf.checksum) {
              const errMsg = `Checksum mismatch en ${mf.version}! El archivo fue modificado después de aplicarse.`;
              console.error(`❌ ALERTA DE INTEGRIDAD: ${errMsg}`);
              throw new Error(errMsg);
            }
            tenantSummary.skipped++;
            continue;
          }

          const shouldBaseline = isBaseline || (baselineUpTo && mf.version <= baselineUpTo);

          // Si es baseline, solo registramos en schema_migrations sin ejecutar el script SQL
          if (shouldBaseline) {
            console.log(`📌 [BASELINE] Marcando ${mf.version} como aplicada...`);
            if (!isDryRun) {
              await tenantClient.query(
                `INSERT INTO schema_migrations (version, checksum, duration_ms)
                 VALUES ($1, $2, 0)
                 ON CONFLICT (version) DO NOTHING`,
                [mf.version, mf.checksum]
              );
            }
            tenantSummary.applied++;
            continue;
          }

          // Ejecutar migración pendiente
          console.log(`⚡ Aplicando: ${mf.version}...`);
          if (isDryRun) {
            console.log(`   [DRY-RUN] Simulación de ejecución exitosa.`);
            tenantSummary.applied++;
            continue;
          }

          const startMs = Date.now();
          if (mf.noTransaction) {
            await tenantClient.query(mf.sqlContent);
          } else {
            await tenantClient.query('BEGIN');
            try {
              await tenantClient.query(mf.sqlContent);
              await tenantClient.query('COMMIT');
            } catch (sqlErr) {
              await tenantClient.query('ROLLBACK');
              throw sqlErr;
            }
          }
          const durationMs = Date.now() - startMs;

          await tenantClient.query(
            `INSERT INTO schema_migrations (version, checksum, duration_ms)
             VALUES ($1, $2, $3)`,
            [mf.version, mf.checksum, durationMs]
          );

          console.log(`✅ ${mf.version} aplicada en ${durationMs}ms`);
          tenantSummary.applied++;
        }

        await tenantClient.end();
      } catch (err: any) {
        tenantSummary.failed = true;
        tenantSummary.error = err.message;
        console.error(`❌ Falló la migración del tenant ${tenant.slug}:`, err.message);
        try {
          await tenantClient.end();
        } catch (_) {}

        if (!isContinueOnError) {
          summary.push(tenantSummary);
          throw err;
        }
      }

      summary.push(tenantSummary);
    }

    // 4. Reporte Resumen
    console.log('\n====================================================');
    console.log('📊 RESUMEN FINAL DE EJECUCIÓN DE MIGRACIONES');
    console.log('====================================================');
    for (const s of summary) {
      const icon = s.failed ? '❌' : '✅';
      console.log(
        `${icon} Tenant ${s.tenant}: ${s.applied} aplicadas, ${s.skipped} omitidas/al día${
          s.failed ? ` (ERROR: ${s.error})` : ''
        }`
      );
    }
  } finally {
    // 5. Liberar Advisory Lock en Master
    await masterClient.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
    await masterClient.end();
    console.log('🔓 Advisory lock liberado en Master.');
  }
}

runTenantMigrations().catch((err) => {
  console.error('\n💥 Proceso de migraciones abortado:', err.message || err);
  process.exit(1);
});
