import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { masterDb, masterTenants, masterIdentities, masterMemberships } from '../../db/master';
import { eq } from 'drizzle-orm';

dotenv.config();

export interface ProvisionTenantInput {
  slug: string;
  name: string;
  adminEmail: string;
  adminName: string;
  adminLastName: string;
  adminPassword?: string;
  dbCluster?: string;
}

export interface ProvisioningResult {
  tenantId: string;
  slug: string;
  name: string;
  databaseName: string;
  status: 'ACTIVE' | 'PROVISIONING' | 'PROVISIONING_FAILED';
  step: string;
  adminEmail: string;
  adminIdentityId: string;
}

export class TenantProvisioningService {
  private static readonly SLUG_REGEX = /^[a-z0-9_]{3,40}$/;

  /**
   * Valida sintácticamente el slug del tenant
   */
  public static validateSlug(slug: string): boolean {
    return this.SLUG_REGEX.test(slug);
  }

  /**
   * Crea o reanuda el aprovisionamiento de un nuevo Tenant con máquina de estados reanudable
   */
  public static async provisionTenant(input: ProvisionTenantInput): Promise<ProvisioningResult> {
    const slug = input.slug.toLowerCase().trim();
    const adminEmail = input.adminEmail.toLowerCase().trim();
    const databaseName = `vitelab_${slug}`;
    const cluster = input.dbCluster || 'default';

    // 1. Validar Slug
    if (!this.validateSlug(slug)) {
      throw new Error(`Slug inválido: "${slug}". Debe coincidir con ^[a-z0-9_]{3,40}$`);
    }

    console.log(`\n🚀 [PROVISIONING] Iniciando creación de tenant: "${slug}" (${input.name})...`);

    // 2. Verificar existencia en master
    const existingTenants = await masterDb
      .select()
      .from(masterTenants)
      .where(eq(masterTenants.slug, slug))
      .limit(1);

    let tenantRecord = existingTenants[0];

    if (tenantRecord && tenantRecord.status === 'ACTIVE') {
      throw new Error(`El tenant con slug "${slug}" ya está activo y configurado.`);
    }

    if (!tenantRecord) {
      console.log(`📝 [PASO 1: VALIDATED] Registrando tenant en estado PROVISIONING...`);
      const [inserted] = await masterDb
        .insert(masterTenants)
        .values({
          slug,
          name: input.name,
          database_name: databaseName,
          db_cluster: cluster,
          status: 'PROVISIONING',
          provisioning_step: 'VALIDATED',
        })
        .returning();
      tenantRecord = inserted;
    }

    const tenantId = tenantRecord.id;

    try {
      // 3. PASO: DB_CREATED (Creación física de base de datos PostgreSQL)
      await this.stepCreateDatabase(databaseName);
      await this.updateStep(tenantId, 'DB_CREATED');

      // 4. PASO: DIRECTORIES_CREATED (Estructura de almacenamiento aislada)
      await this.stepCreateDirectories(tenantId);

      // 5. PASO: MIGRATED (Aplicación de base y todas las migraciones en orden)
      await this.stepRunMigrations(databaseName);
      await this.updateStep(tenantId, 'MIGRATED');

      // 6. PASO: SEEDED (Configuración inicial de la clínica)
      await this.stepSeedConfiguration(databaseName, input.name);
      await this.updateStep(tenantId, 'SEEDED');

      // 7. PASO: ADMIN_INVITED (Crear/vincular identidad en Master y usuario ADMIN en tenant)
      const identityId = await this.stepSetupAdmin(
        tenantId,
        databaseName,
        adminEmail,
        input.adminName,
        input.adminLastName,
        input.adminPassword
      );
      await this.updateStep(tenantId, 'ADMIN_INVITED');

      // 8. FINALIZACIÓN: ACTIVE
      await masterDb
        .update(masterTenants)
        .set({
          status: 'ACTIVE',
          provisioning_step: 'COMPLETED',
          updated_at: new Date(),
        })
        .where(eq(masterTenants.id, tenantId));

      console.log(`🎉 [PROVISIONING COMPLETADO] Tenant "${slug}" aprovisionado y listo para operar.\n`);

      return {
        tenantId,
        slug,
        name: input.name,
        databaseName,
        status: 'ACTIVE',
        step: 'COMPLETED',
        adminEmail,
        adminIdentityId: identityId,
      };
    } catch (err: any) {
      console.error(`💥 [PROVISIONING FAILED] Error durante el aprovisionamiento de ${slug}:`, err.message);
      await masterDb
        .update(masterTenants)
        .set({
          status: 'PROVISIONING_FAILED',
          updated_at: new Date(),
        })
        .where(eq(masterTenants.id, tenantId));

      throw err;
    }
  }

  /**
   * Actualiza el paso de aprovisionamiento en la tabla masterTenants
   */
  private static async updateStep(tenantId: string, step: string): Promise<void> {
    await masterDb
      .update(masterTenants)
      .set({
        provisioning_step: step,
        updated_at: new Date(),
      })
      .where(eq(masterTenants.id, tenantId));
    console.log(`📍 [PROVISIONING] Paso completado: ${step}`);
  }

  /**
   * Paso 2: Crear base de datos PostgreSQL física de forma segura
   */
  private static async stepCreateDatabase(databaseName: string): Promise<void> {
    const adminClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: 'postgres',
      user: process.env.DB_USER || 'fcsadmin',
      password: process.env.DB_PASSWORD,
    });

    await adminClient.connect();
    try {
      const checkRes = await adminClient.query(
        'SELECT datname FROM pg_database WHERE datname = $1',
        [databaseName]
      );

      if (checkRes.rows.length === 0) {
        console.log(`📦 Creando base de datos física: ${databaseName}...`);
        // Escapado seguro: databaseName ya fue validado estrictamente con ^vitelab_[a-z0-9_]{3,40}$
        await adminClient.query(`CREATE DATABASE "${databaseName}"`);
        console.log(`✅ Base de datos ${databaseName} creada.`);
      } else {
        console.log(`ℹ️ Base de datos ${databaseName} ya existía previamente.`);
      }
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Paso 3: Crear estructura de carpetas de almacenamiento para el tenant
   */
  private static async stepCreateDirectories(tenantId: string): Promise<void> {
    const baseUploads = path.resolve(__dirname, '../../../uploads/tenants', tenantId);
    const subdirs = ['firmas', 'logos', 'resultados'];

    for (const sub of subdirs) {
      const dirPath = path.join(baseUploads, sub);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
    console.log(`📂 Carpetas de almacenamiento creadas para tenant ${tenantId}`);
  }

  /**
   * Paso 4: Ejecutar database.sql y todas las migraciones en la nueva base de datos
   */
  private static async stepRunMigrations(databaseName: string): Promise<void> {
    const tenantClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: databaseName,
      user: process.env.DB_USER || 'fcsadmin',
      password: process.env.DB_PASSWORD,
    });

    await tenantClient.connect();

    try {
      // 1. Ejecutar database.sql si no hay tablas
      const tablesRes = await tenantClient.query(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'"
      );

      if (tablesRes.rows[0].count === 0) {
        console.log(`⚡ Aplicando esquema base (database.sql) en ${databaseName}...`);
        const databaseSqlPath = path.resolve(__dirname, '../../../database.sql');
        let dbSql = fs.readFileSync(databaseSqlPath, 'utf8');
        dbSql = dbSql.replace(/CREATE DATABASE[\s\S]*?\\c vitelab_db;/gi, '');
        await tenantClient.query(dbSql);
        console.log(`✅ Esquema base database.sql aplicado.`);
      }

      // 2. Asegurar schema_migrations
      await tenantClient.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version      VARCHAR(100) PRIMARY KEY,
          checksum     CHAR(64)     NOT NULL,
          applied_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
          duration_ms  INTEGER
        );
      `);

      // 3. Ejecutar todas las migraciones de update BD/
      const updatesDir = path.resolve(__dirname, '../../../update BD');
      const files = fs
        .readdirSync(updatesDir)
        .filter((f) => /^\d{3}_.*\.sql$/.test(f))
        .sort();

      for (const filename of files) {
        const filePath = path.join(updatesDir, filename);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        const checksum = crypto.createHash('sha256').update(sqlContent, 'utf8').digest('hex');

        const existing = await tenantClient.query(
          'SELECT version FROM schema_migrations WHERE version = $1',
          [filename]
        );

        if (existing.rows.length > 0) {
          continue;
        }

        const startMs = Date.now();
        await tenantClient.query('BEGIN');
        try {
          await tenantClient.query(sqlContent);
          await tenantClient.query('COMMIT');
        } catch (mErr) {
          await tenantClient.query('ROLLBACK');
          throw mErr;
        }
        const durationMs = Date.now() - startMs;

        await tenantClient.query(
          `INSERT INTO schema_migrations (version, checksum, duration_ms)
           VALUES ($1, $2, $3)`,
          [filename, checksum, durationMs]
        );
        console.log(`  ✅ Migración ${filename} aplicada (${durationMs}ms)`);
      }
    } finally {
      await tenantClient.end();
    }
  }

  /**
   * Paso 5: Seed de configuración específica del laboratorio
   */
  private static async stepSeedConfiguration(databaseName: string, companyName: string): Promise<void> {
    const tenantClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: databaseName,
      user: process.env.DB_USER || 'fcsadmin',
      password: process.env.DB_PASSWORD,
    });

    await tenantClient.connect();
    try {
      await tenantClient.query(
        `UPDATE configuracion_sistema
         SET empresa_nombre = $1, updated_at = now()
         WHERE id = 1`,
        [companyName]
      );
    } finally {
      await tenantClient.end();
    }
  }

  /**
   * Paso 6: Configuración del usuario administrador
   */
  private static async stepSetupAdmin(
    tenantId: string,
    databaseName: string,
    email: string,
    name: string,
    lastName: string,
    password?: string
  ): Promise<string> {
    // 1. Identidad en vitelab_master
    const existingIdentity = await masterDb
      .select()
      .from(masterIdentities)
      .where(eq(masterIdentities.email, email))
      .limit(1);

    let identityId: string;
    let passwordHash: string;

    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    } else {
      passwordHash = await bcrypt.hash('ViteLab123456!', 10);
    }

    if (existingIdentity.length > 0) {
      identityId = existingIdentity[0].id;
      console.log(`ℹ️ Identidad existente reutilizada en Master (${email})`);
    } else {
      const [newIdentity] = await masterDb
        .insert(masterIdentities)
        .values({
          email,
          password_hash: passwordHash,
          status: password ? 'ACTIVE' : 'INVITED',
        })
        .returning();
      identityId = newIdentity.id;
      console.log(`✅ Nueva identidad creada en Master (${email})`);
    }

    // 2. Membership en vitelab_master
    await masterDb
      .insert(masterMemberships)
      .values({
        identity_id: identityId,
        tenant_id: tenantId,
        status: 'ACTIVE',
      })
      .onConflictDoUpdate({
        target: [masterMemberships.identity_id, masterMemberships.tenant_id],
        set: {
          status: 'ACTIVE',
          updated_at: new Date(),
        },
      });

    // 3. Usuario en la BD del Tenant
    const tenantClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: databaseName,
      user: process.env.DB_USER || 'fcsadmin',
      password: process.env.DB_PASSWORD,
    });

    await tenantClient.connect();

    try {
      // 1. Buscar ID del rol ADMIN
      const roleRes = await tenantClient.query(
        "SELECT id FROM roles WHERE upper(nombre) = 'ADMIN' OR upper(nombre) = 'ADMINISTRADOR' LIMIT 1"
      );
      const adminRoleId = roleRes.rows.length > 0 ? roleRes.rows[0].id : 1;

      // 2. Crear o reutilizar ficha en tabla 'personal'
      let personalId: number;
      const existingPersonal = await tenantClient.query(
        'SELECT id FROM personal WHERE email = $1 LIMIT 1',
        [email]
      );

      if (existingPersonal.rows.length > 0) {
        personalId = existingPersonal.rows[0].id;
      } else {
        const insertPersonalRes = await tenantClient.query(
          `INSERT INTO personal (nombres, apellidos, cargo, area, email, activo)
           VALUES ($1, $2, 'Director General / Administrador', 'Administración', $3, true)
           RETURNING id`,
          [name, lastName, email]
        );
        personalId = insertPersonalRes.rows[0].id;

        // Asignar sede central si existe
        const sedeRes = await tenantClient.query('SELECT id FROM sedes LIMIT 1');
        if (sedeRes.rows.length > 0) {
          await tenantClient.query(
            `INSERT INTO personal_sedes (personal_id, sede_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [personalId, sedeRes.rows[0].id]
          );
        }
      }

      // 3. Crear o actualizar usuario vinculado
      const username = email.split('@')[0];

      await tenantClient.query(
        `INSERT INTO usuarios (
          username, email, password_hash, rol_id, identity_id, personal_id, activo
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (email) DO UPDATE
        SET identity_id = EXCLUDED.identity_id,
            rol_id = EXCLUDED.rol_id,
            personal_id = EXCLUDED.personal_id,
            activo = true`,
        [username, email, passwordHash, adminRoleId, identityId, personalId]
      );

      console.log(`✅ Usuario administrador creado en el tenant (${email}) con rol ADMIN y personal vinculado.`);
    } finally {
      await tenantClient.end();
    }

    return identityId;
  }
}
