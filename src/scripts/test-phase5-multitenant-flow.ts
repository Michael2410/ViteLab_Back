import { Client } from 'pg';
import { masterPool } from '../db/master';
import { authService } from '../modules/auth/auth.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { runInTenant } from '../db/tenant-context';
import { db } from '../db';
import { personal, usuarios } from '../db/drizzle-generated/schema';
import { eq } from 'drizzle-orm';
import { TenantProvisioningService } from '../modules/tenants/provisioning.service';

async function runPhase5AcceptanceTests() {
  console.log('====================================================');
  console.log('🚀 INICIANDO PRUEBAS DE ACEPTACIÓN - FASE 5');
  console.log('   (Multi-Membresía, Login con Selección & Switch)');
  console.log('====================================================\n');

  let passedCount = 0;
  let totalTests = 5;

  const testEmail = 'multi_lab_tester@vitelab.com';
  const testPassword = 'Password123!';
  let testIdentityId: string | null = null;
  let tenant1Id: string | null = null;
  let tenant2Id: string | null = null;

  try {
    // 0. Setup: Limpiar usuario previo y residuos antes de comenzar
    await masterPool.query(`DELETE FROM sessions WHERE identity_id IN (SELECT id FROM identities WHERE email = $1)`, [testEmail]);
    await masterPool.query(`DELETE FROM memberships WHERE identity_id IN (SELECT id FROM identities WHERE email = $1)`, [testEmail]);
    await masterPool.query(`DELETE FROM identities WHERE email = $1`, [testEmail]);
    await masterPool.query(`DELETE FROM sessions WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = 'vitelab_norte_test')`);
    await masterPool.query(`DELETE FROM memberships WHERE tenant_id IN (SELECT id FROM tenants WHERE slug = 'vitelab_norte_test')`);
    await masterPool.query(`DELETE FROM tenants WHERE slug = 'vitelab_norte_test'`);

    // Buscar dos tenants activos en Master
    const tenantsRes = await masterPool.query(
      `SELECT id, slug, name FROM tenants WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 2`
    );

    if (tenantsRes.rows.length < 2) {
      console.log('ℹ️ Se requiere un segundo tenant. Provisionando tenant temporal con TenantProvisioningService...');
      const provResult = await TenantProvisioningService.provisionTenant({
        slug: 'vitelab_norte_test',
        name: 'ViteLab Sede Norte Test',
        adminEmail: 'temp_admin@vitelab.com',
        adminName: 'Admin',
        adminLastName: 'Temporal',
        adminPassword: 'Password123!',
      });
      tenant1Id = tenantsRes.rows[0].id;
      tenant2Id = provResult.tenantId;
    } else {
      tenant1Id = tenantsRes.rows[0].id;
      tenant2Id = tenantsRes.rows[1].id;
    }

    console.log(`📌 Tenants de prueba:`);
    console.log(`   Tenant 1: ${tenant1Id} (${tenantsRes.rows[0]?.slug || 'vitelab_central'})`);
    console.log(`   Tenant 2: ${tenant2Id}`);

    // Crear identidad de prueba en Master con MFA habilitado
    const hash = await bcrypt.hash(testPassword, 10);
    const idRes = await masterPool.query(
      `INSERT INTO identities (email, password_hash, status, mfa_enabled)
       VALUES ($1, $2, 'ACTIVE', true)
       RETURNING id`,
      [testEmail, hash]
    );
    testIdentityId = idRes.rows[0].id;

    // Asignar membresía activa en Tenant 1
    await masterPool.query(
      `INSERT INTO memberships (tenant_id, identity_id, status)
       VALUES ($1, $2, 'ACTIVE')`,
      [tenant1Id, testIdentityId]
    );

    // Asignar membresía activa en Tenant 2
    await masterPool.query(
      `INSERT INTO memberships (tenant_id, identity_id, status)
       VALUES ($1, $2, 'ACTIVE')`,
      [tenant2Id, testIdentityId]
    );

    // Crear registro de usuario en cada base de datos tenant
    const randDoc1 = String(Math.floor(10000000 + Math.random() * 89999999));
    const randDoc2 = String(Math.floor(10000000 + Math.random() * 89999999));

    await runInTenant(tenant1Id!, { kind: 'system', job: 'test:setup' }, async () => {
      await db.delete(usuarios).where(eq(usuarios.email, testEmail));
      const [pers] = await db.insert(personal).values({
        nombres: 'Tester',
        apellidos: 'Central',
        tipo_documento: 'DNI',
        numero_documento: randDoc1,
      }).returning();
      await db.insert(usuarios).values({
        username: 'multilab',
        email: testEmail,
        password_hash: hash,
        rol_id: 1,
        personal_id: pers.id,
        identity_id: testIdentityId,
        activo: true,
      });
    });

    await runInTenant(tenant2Id!, { kind: 'system', job: 'test:setup' }, async () => {
      await db.delete(usuarios).where(eq(usuarios.email, testEmail));
      const [pers] = await db.insert(personal).values({
        nombres: 'Tester',
        apellidos: 'Norte',
        tipo_documento: 'DNI',
        numero_documento: randDoc2,
      }).returning();
      await db.insert(usuarios).values({
        username: 'multilab',
        email: testEmail,
        password_hash: hash,
        rol_id: 1,
        personal_id: pers.id,
        identity_id: testIdentityId,
        activo: true,
      });
    });

    console.log(`✅ Identidad creada con 2 membresías activas y usuarios sincronizados en ambas DBs.`);

    // ------------------------------------------------------------------
    // TEST 1: Login con múltiples membresías retorna requiresTenantSelection
    // ------------------------------------------------------------------
    console.log('\n--- TEST 1: Login de usuario con múltiples tenants activos ---');
    const loginResult = await authService.loginMaster(
      { username: testEmail, password: testPassword },
      '127.0.0.1',
      'Phase5-Acceptance-Agent'
    );

    if (loginResult && 'requiresTenantSelection' in loginResult && loginResult.requiresTenantSelection) {
      console.log('✅ TEST 1 PASADO: Login detectó múltiples membresías y solicitó selección de tenant.');
      console.log(`   Tenants ofrecidos: ${loginResult.tenants.length} (${loginResult.tenants.map(t => t.name).join(', ')})`);
      passedCount++;
    } else {
      throw new Error(`TEST 1 FALLÓ: Se esperaba requiresTenantSelection: true, recibido: ${JSON.stringify(loginResult)}`);
    }

    const tempToken = (loginResult as any).tempToken;

    // ------------------------------------------------------------------
    // TEST 2: Selección de Tenant con tempToken válido
    // ------------------------------------------------------------------
    console.log('\n--- TEST 2: Endpoint selectTenant con tempToken ---');
    const selectResult = (await authService.selectTenant(tempToken, tenant1Id!)) as any;

    if (
      selectResult &&
      selectResult.accessToken &&
      selectResult.activeTenant &&
      selectResult.activeTenant.id === tenant1Id
    ) {
      console.log('✅ TEST 2 PASADO: Token emitido y amarrado exitosamente al Tenant 1.');
      console.log(`   Active Tenant en respuesta: ${selectResult.activeTenant.name} (${selectResult.activeTenant.slug})`);
      passedCount++;
    } else {
      throw new Error(`TEST 2 FALLÓ: No se vinculó correctamente el Tenant 1: ${JSON.stringify(selectResult)}`);
    }

    const initialAccessToken = selectResult.accessToken;
    const decodedToken = jwt.verify(
      initialAccessToken,
      process.env.JWT_ACCESS_SECRET || 'access_secret'
    ) as any;
    const currentSessionId = decodedToken.sessionId;

    // ------------------------------------------------------------------
    // TEST 3: Switch de Tenant en caliente
    // ------------------------------------------------------------------
    console.log('\n--- TEST 3: Switch de Tenant en caliente a Tenant 2 ---');
    const switchResult = (await authService.switchTenant(testIdentityId!, currentSessionId, tenant2Id!)) as any;

    if (
      switchResult &&
      switchResult.accessToken &&
      switchResult.activeTenant &&
      switchResult.activeTenant.id === tenant2Id
    ) {
      console.log('✅ TEST 3 PASADO: Switch completado exitosamente a Tenant 2.');
      console.log(`   Nuevo Active Tenant: ${switchResult.activeTenant.name} (${switchResult.activeTenant.slug})`);
      passedCount++;
    } else {
      throw new Error(`TEST 3 FALLÓ: No se completó el switch a Tenant 2: ${JSON.stringify(switchResult)}`);
    }

    // ------------------------------------------------------------------
    // TEST 4: Bloqueo de Switch a un Tenant sin membresía (Fail-Closed)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 4: Intento de Switch a un Tenant no autorizado (Fail-Closed) ---');
    let unauthorizedBlocked = false;
    try {
      await authService.switchTenant(testIdentityId!, currentSessionId, '99999999-9999-9999-9999-999999999999');
    } catch (err: any) {
      if (err.message && (err.message.includes('No tiene membresía') || err.message.includes('no encontrado'))) {
        unauthorizedBlocked = true;
      }
    }

    if (unauthorizedBlocked) {
      console.log('✅ TEST 4 PASADO: Acceso denegado estrictamente ante Tenant no asignado.');
      passedCount++;
    } else {
      throw new Error('TEST 4 FALLÓ: Permitió o no manejó adecuadamente el switch a un tenant ajeno.');
    }

    // ------------------------------------------------------------------
    // TEST 5: Consulta de laboratorios disponibles (getUserActiveTenants)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 5: Consulta de tenants disponibles del usuario ---');
    const userTenants = await authService.getUserActiveTenants(testIdentityId!, tenant2Id!);

    const currentTenant = userTenants.find(t => t.isCurrent);
    if (userTenants.length === 2 && currentTenant && currentTenant.id === tenant2Id) {
      console.log('✅ TEST 5 PASADO: Lista de membresías con indicador de tenant activo correcto.');
      console.log(`   Membresías: ${userTenants.map(t => `${t.name} (actual: ${t.isCurrent})`).join(' | ')}`);
      passedCount++;
    } else {
      throw new Error(`TEST 5 FALLÓ: Lista de tenants incorrecta: ${JSON.stringify(userTenants)}`);
    }

  } catch (error: any) {
    console.error('❌ Error en ejecución de pruebas Fase 5:', error);
  } finally {
    // Limpieza
    try {
      if (testIdentityId) {
        await masterPool.query(`DELETE FROM sessions WHERE identity_id = $1`, [testIdentityId]);
        await masterPool.query(`DELETE FROM memberships WHERE identity_id = $1`, [testIdentityId]);
        await masterPool.query(`DELETE FROM identities WHERE id = $1`, [testIdentityId]);
      }
      const norteTenant = await masterPool.query(`SELECT id, database_name FROM tenants WHERE slug = 'vitelab_norte_test'`);
      if (norteTenant.rows.length > 0) {
        const dbToDrop = norteTenant.rows[0].database_name;
        await masterPool.query(`DELETE FROM sessions WHERE tenant_id = $1`, [norteTenant.rows[0].id]);
        await masterPool.query(`DELETE FROM memberships WHERE tenant_id = $1`, [norteTenant.rows[0].id]);
        await masterPool.query(`DELETE FROM tenants WHERE id = $1`, [norteTenant.rows[0].id]);

        const defaultClient = new Client({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          database: 'postgres',
          user: process.env.DB_USER || 'fcsadmin',
          password: process.env.DB_PASSWORD,
        });
        await defaultClient.connect();
        await defaultClient.query(`
          SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();
        `, [dbToDrop]);
        await defaultClient.query(`DROP DATABASE IF EXISTS ${dbToDrop};`);
        await defaultClient.end();
      }
      console.log('\n🧹 Datos y base de datos de prueba limpiados exitosamente.');
    } catch (cleanupErr) {
      console.warn('⚠️ Advertencia en limpieza:', cleanupErr);
    }

    console.log('\n====================================================');
    console.log(`📊 RESULTADO FASE 5: ${passedCount}/${totalTests} PRUEBAS SUPERADAS (${Math.round((passedCount / totalTests) * 100)}%)`);
    console.log('====================================================\n');

    process.exit(passedCount === totalTests ? 0 : 1);
  }
}

runPhase5AcceptanceTests();
