import dotenv from 'dotenv';
dotenv.config();

import { Client } from 'pg';
import { sql, eq } from 'drizzle-orm';
import { db, usuarios, runInTenant, tenantConnectionManager } from '../db';
import { masterDb, masterTenants } from '../db/master';

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO PRUEBAS DE ACEPTACIÓN - FASE 2 (CONTEXTO TENANT)');
  console.log('====================================================');
  console.log(`🔧 AUTH_SOURCE = ${process.env.AUTH_SOURCE}`);

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------
  // TEST 1: FAIL-CLOSED (Acceso sin contexto debe ser rechazado)
  // ----------------------------------------------------
  console.log('\n[PRUEBA 1] Verificación Fail-Closed (acceso sin contexto)...');
  try {
    // Intentar acceder a db directamente sin tenantStorage
    const res = await (db as any).execute(sql`SELECT 1`);
    console.error('❌ FALLÓ: El acceso sin contexto debió haber lanzado una excepción!', res);
    failed++;
  } catch (err: any) {
    if (err.message && err.message.includes('Fail-Closed')) {
      console.log('✅ ÉXITO: Fail-Closed funcionó correctamente y rechazó la consulta:');
      console.log(`   "${err.message}"`);
      passed++;
    } else {
      console.error('❌ FALLÓ: Se lanzó una excepción inesperada:', err);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 2: EJECUCIÓN EN CONTEXTO DE TENANT CENTRAL
  // ----------------------------------------------------
  console.log('\n[PRUEBA 2] Ejecución dentro de runInTenant("vitelab_central")...');
  try {
    const result = await runInTenant('vitelab_central', { kind: 'system', job: 'test:central' }, async () => {
      // 1. Verificar nombre de la base de datos física actual
      const dbNameResult = await db.execute(sql`SELECT current_database() as db_name`);
      const dbName = (dbNameResult as any).rows[0].db_name;

      // 2. Consultar usuarios en el tenant
      const userList = await db
        .select({ id: usuarios.id, username: usuarios.username, email: usuarios.email })
        .from(usuarios);

      return { dbName, userCount: userList.length, users: userList.map((u) => u.username) };
    });

    if (result.dbName === 'vitelab_db' && result.userCount >= 3) {
      console.log('✅ ÉXITO: Consulta ejecutada en la base de datos correcta:', result.dbName);
      console.log(`   Usuarios encontrados (${result.userCount}): ${result.users.join(', ')}`);
      passed++;
    } else {
      console.error('❌ FALLÓ: Datos inesperados devueltos:', result);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FALLÓ: Error al ejecutar en contexto central:', err);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 3: AISLAMIENTO MULTI-TENANT (TENANT A vs TENANT B)
  // ----------------------------------------------------
  console.log('\n[PRUEBA 3] Aislamiento estricto multi-tenant y concurrencia...');
  const testDbName = 'vitelab_tenant_beta_test';
  const testSlug = 'tenant_beta_staging';
  const pgAdmin = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'fcsadmin',
    password: process.env.DB_PASSWORD || 'm54m4dm1np455',
    database: 'postgres',
  });

  let betaTenantId: string | null = null;

  try {
    await pgAdmin.connect();

    // 1. Crear base de datos de prueba para Tenant Beta
    await pgAdmin.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    await pgAdmin.query(`CREATE DATABASE ${testDbName}`);
    console.log(`   📦 Base de datos temporal creada: ${testDbName}`);

    // 2. Crear tabla exclusiva en Tenant Beta
    const pgBeta = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'fcsadmin',
      password: process.env.DB_PASSWORD || 'm54m4dm1np455',
      database: testDbName,
    });
    await pgBeta.connect();
    await pgBeta.query(`
      CREATE TABLE tenant_marker (
        id SERIAL PRIMARY KEY,
        tenant_name VARCHAR(100),
        secret_token VARCHAR(100)
      );
      INSERT INTO tenant_marker (tenant_name, secret_token)
      VALUES ('Clinica Beta Norte', 'BETA_SECRET_987654');
    `);
    await pgBeta.end();

    // 3. Registrar Tenant Beta en vitelab_master
    const [inserted] = await masterDb
      .insert(masterTenants)
      .values({
        slug: testSlug,
        name: 'Clínica Beta Norte',
        database_name: testDbName,
        status: 'ACTIVE',
      })
      .returning({ id: masterTenants.id });
    betaTenantId = inserted.id;
    console.log(`   🏢 Tenant registrado en Master: slug=${testSlug}, id=${betaTenantId}`);

    // 4. Ejecutar consultas concurrentes intercaladas entre Tenant A y Tenant B
    const concurrencyPromises: Promise<{ iteration: number; expected: string; actual: string; match: boolean }>[] = [];

    for (let i = 0; i < 10; i++) {
      const isBeta = i % 2 === 1;
      const targetSlug = isBeta ? testSlug : 'vitelab_central';
      const expectedDb = isBeta ? testDbName : 'vitelab_db';

      concurrencyPromises.push(
        runInTenant(targetSlug, { kind: 'system', job: `stress:test:${i}` }, async () => {
          const res = await db.execute(sql`SELECT current_database() as db_name`);
          const actualDb = (res as any).rows[0].db_name;
          return {
            iteration: i,
            expected: expectedDb,
            actual: actualDb,
            match: expectedDb === actualDb,
          };
        })
      );
    }

    const concurrencyResults = await Promise.all(concurrencyPromises);
    const allMatched = concurrencyResults.every((r) => r.match);

    if (allMatched) {
      console.log('✅ ÉXITO: 10 consultas asíncronas concurrentes intercaladas resolvieron su BD exacta sin contaminación cruzada.');
      passed++;
    } else {
      console.error('❌ FALLÓ: Hubo contaminación en consultas concurrentes:', concurrencyResults);
      failed++;
    }

    // 5. Validar que la tabla exclusiva de Beta NO existe en vitelab_central
    let centralLeak = false;
    try {
      await runInTenant('vitelab_central', { kind: 'system', job: 'leak:test' }, async () => {
        await db.execute(sql`SELECT * FROM tenant_marker`);
      });
      centralLeak = true;
    } catch {
      // Es correcto que falle porque la tabla solo existe en Tenant Beta
      centralLeak = false;
    }

    if (!centralLeak) {
      console.log('✅ ÉXITO: La tabla de Tenant Beta no existe en Tenant Central (Aislamiento físico verificado).');
      passed++;
    } else {
      console.error('❌ FALLÓ: La tabla de Tenant Beta fue visible desde Tenant Central!');
      failed++;
    }

  } catch (err) {
    console.error('❌ Error en prueba de aislamiento:', err);
    failed++;
  } finally {
    // Limpieza
    console.log('   🧹 Limpiando base de datos temporal y registro en master...');
    try {
      if (betaTenantId) {
        await masterDb.delete(masterTenants).where(eq(masterTenants.id, betaTenantId));
      }
      // Desconectar pools antes del drop
      await tenantConnectionManager.closeAll();
      await pgAdmin.query(`DROP DATABASE IF EXISTS ${testDbName}`);
      await pgAdmin.end();
      console.log('   ✨ Limpieza completada con éxito.');
    } catch (cleanErr) {
      console.warn('   ⚠️ Error durante limpieza:', cleanErr);
    }
  }

  // ----------------------------------------------------
  // TEST 4: GESTIÓN DE LEASES Y STATS DEL POOL
  // ----------------------------------------------------
  console.log('\n[PRUEBA 4] Ciclo de vida de leases y métricas de conexión...');
  try {
    // Correr una consulta y verificar leases
    await runInTenant('vitelab_central', { kind: 'system', job: 'pool:metrics' }, async () => {
      const statsInside = tenantConnectionManager.getPoolStats();
      console.log('   Métricas durante la ejecución en contexto:', statsInside);
      if (statsInside.activeTenants >= 1) {
        console.log('   Lease activo detectado correctamente.');
      }
    });

    const statsAfter = tenantConnectionManager.getPoolStats();
    console.log('   Métricas después de liberar contexto:', statsAfter);
    const centralPool = statsAfter.pools.find((p: any) => p.databaseName === 'vitelab_db');
    if (centralPool && centralPool.activeLeases === 0) {
      console.log('✅ ÉXITO: El lease fue liberado inmediatamente tras finalizar la ejecución (activeLeases: 0).');
      passed++;
    } else {
      console.error('❌ FALLÓ: El lease no volvió a 0:', centralPool);
      failed++;
    }
  } catch (err: any) {
    console.error('❌ FALLÓ: Error al verificar métricas del pool:', err);
    failed++;
  }

  // Cerrar pools para finalizar el script limpiamente
  await tenantConnectionManager.closeAll();

  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL FASE 2: ${passed} Pasadas | ${failed} Fallidas`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Error fatal en suite de pruebas Fase 2:', err);
  process.exit(1);
});
