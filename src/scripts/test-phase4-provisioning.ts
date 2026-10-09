import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { masterDb, masterTenants, masterIdentities, masterMemberships } from '../db/master';
import { eq } from 'drizzle-orm';
import { TenantProvisioningService } from '../modules/tenants/provisioning.service';
import { runInTenant } from '../db/tenant-context';
import { db } from '../db';
import { configuracionSistema, usuarios, roles } from '../db/drizzle-generated/schema';

dotenv.config();

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO PRUEBAS DE ACEPTACIÓN - FASE 4');
  console.log('   (MIGRACIONES Y PROVISIONING DE TENANTS)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // ----------------------------------------------------
  // TEST 1: Validación de Slugs y Rechazo de Caracteres Inválidos
  // ----------------------------------------------------
  console.log('[PRUEBA 1] Validación de sintaxis de Slugs (según GUIA-AGENTE)...');
  try {
    const validSlugs = ['lab_central', 'clinica123', 'salud_norte_sur'];
    const invalidSlugs = ['Lab', 'ab', 'clinica!', 'mi clinica', 'un_slug_extremadamente_largo_que_supera_cuarenta_caracteres_totales'];

    for (const s of validSlugs) {
      if (!TenantProvisioningService.validateSlug(s)) {
        throw new Error(`Slug válido "${s}" fue rechazado`);
      }
    }

    for (const s of invalidSlugs) {
      if (TenantProvisioningService.validateSlug(s)) {
        throw new Error(`Slug inválido "${s}" fue aceptado incorrectamente`);
      }
    }

    console.log('✅ ÉXITO 1: Expresión regular ^[a-z0-9_]{3,40}$ validó correctamente casos válidos e inválidos.');
    passed++;
  } catch (err: any) {
    console.error('❌ FALLÓ PRUEBA 1:', err.message);
    failed++;
  }

  // ----------------------------------------------------
  // TEST 2: Provisioning Automatizado Completo de un Nuevo Tenant
  // ----------------------------------------------------
  console.log('\n[PRUEBA 2] Provisión integral de nuevo Tenant (BD física, tablas, seeds, master e identidad)...');
  const testSlug = 'fase4_demo_lab';
  const testDbName = `vitelab_${testSlug}`;
  const testAdminEmail = 'director@fase4demolab.com';
  const testAdminPass = 'DemoPass4_2026!';
  let provisionedTenantId: string | null = null;

  try {
    // Si existía de un intento previo, limpiar
    const pgAdmin = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: 'postgres',
      user: process.env.DB_USER || 'fcsadmin',
      password: process.env.DB_PASSWORD,
    });
    await pgAdmin.connect();
    await pgAdmin.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await pgAdmin.end();

    const existingInMaster = await masterDb
      .select()
      .from(masterTenants)
      .where(eq(masterTenants.slug, testSlug));
    if (existingInMaster.length > 0) {
      await masterDb.delete(masterMemberships).where(eq(masterMemberships.tenant_id, existingInMaster[0].id));
      await masterDb.delete(masterTenants).where(eq(masterTenants.id, existingInMaster[0].id));
    }

    // Ejecutar provisión
    const result = await TenantProvisioningService.provisionTenant({
      slug: testSlug,
      name: 'Clínica San Lucas - Fase 4',
      adminEmail: testAdminEmail,
      adminName: 'Lucas',
      adminLastName: 'San Martin',
      adminPassword: testAdminPass,
    });

    provisionedTenantId = result.tenantId;

    if (result.status !== 'ACTIVE' || result.step !== 'COMPLETED') {
      throw new Error(`Estado o paso incorrecto: status=${result.status}, step=${result.step}`);
    }

    console.log('✅ ÉXITO 2a: Servicio de provisión completó el ciclo con status ACTIVE y step COMPLETED.');
    passed++;

    // Verificar en vitelab_master
    const [masterRecord] = await masterDb
      .select()
      .from(masterTenants)
      .where(eq(masterTenants.id, provisionedTenantId));

    if (!masterRecord || masterRecord.database_name !== testDbName) {
      throw new Error('El registro del tenant en vitelab_master no coincide con la base de datos creada.');
    }
    console.log('✅ ÉXITO 2b: Tenant registrado y confirmado en vitelab_master.tenants.');
    passed++;

    // Verificar estructura de carpetas creada
    const uploadsDir = path.resolve(__dirname, '../../uploads/tenants', provisionedTenantId);
    if (
      !fs.existsSync(path.join(uploadsDir, 'firmas')) ||
      !fs.existsSync(path.join(uploadsDir, 'logos')) ||
      !fs.existsSync(path.join(uploadsDir, 'resultados'))
    ) {
      throw new Error('No se crearon las subcarpetas de almacenamiento para el tenant.');
    }
    console.log('✅ ÉXITO 2c: Directorios de uploads aislados creados correctamente.');
    passed++;

    // Verificar tablas y migraciones en la nueva base de datos del tenant
    const tenantClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: testDbName,
      user: process.env.DB_USER || 'fcsadmin',
      password: process.env.DB_PASSWORD,
    });
    await tenantClient.connect();

    const tablesRes = await tenantClient.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    if (tablesRes.rows.length < 35) {
      throw new Error(`Se esperaban al menos 35 tablas, pero se encontraron ${tablesRes.rows.length}`);
    }

    const migRes = await tenantClient.query('SELECT count(*)::int AS count FROM schema_migrations');
    if (migRes.rows[0].count < 30) {
      throw new Error(`Se esperaban al menos 30 migraciones aplicadas, pero se encontraron ${migRes.rows[0].count}`);
    }

    // Verificar que configuracion_sistema tiene el nombre de la empresa personalizado
    const configRes = await tenantClient.query('SELECT empresa_nombre FROM configuracion_sistema WHERE id = 1');
    if (configRes.rows[0].empresa_nombre !== 'Clínica San Lucas - Fase 4') {
      throw new Error(`Nombre de empresa en BD no coincide: ${configRes.rows[0].empresa_nombre}`);
    }

    // Verificar usuario ADMIN en la nueva BD
    const userRes = await tenantClient.query(
      'SELECT u.email, u.identity_id, r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.email = $1',
      [testAdminEmail]
    );
    if (userRes.rows.length === 0 || userRes.rows[0].rol.toUpperCase() !== 'ADMIN') {
      throw new Error('El usuario administrador no fue creado correctamente en la tabla usuarios con rol ADMIN.');
    }

    await tenantClient.end();
    console.log(`✅ ÉXITO 2d: Nueva base de datos verificada (${tablesRes.rows.length} tablas, ${migRes.rows[0].count} migraciones, config y usuario admin validados).`);
    passed++;

    // ----------------------------------------------------
    // TEST 3: Consulta Segura a través de Proxy `db` en el nuevo Tenant
    // ----------------------------------------------------
    console.log('\n[PRUEBA 3] Consulta transparente a través de Proxy `db` en el nuevo Tenant...');
    await runInTenant(
      provisionedTenantId,
      {
        kind: 'user',
        identityId: result.adminIdentityId,
        usuarioId: 1,
      },
      async () => {
        const config = await db.select().from(configuracionSistema).limit(1);
        if (config.length === 0 || config[0].empresa_nombre !== 'Clínica San Lucas - Fase 4') {
          throw new Error(`Proxy no resolvió datos del nuevo tenant: ${JSON.stringify(config)}`);
        }

        const adminUser = await db.select().from(usuarios).where(eq(usuarios.email, testAdminEmail)).limit(1);
        if (adminUser.length === 0 || adminUser[0].identity_id !== result.adminIdentityId) {
          throw new Error('Proxy no resolvió el usuario admin con identity_id correcto.');
        }
      }
    );
    console.log('✅ ÉXITO 3: El Proxy `db` resolvió y consultó de forma totalmente transparente y aislada el nuevo tenant.');
    passed++;

  } catch (err: any) {
    console.error('❌ FALLÓ PRUEBA 2/3:', err.message);
    failed++;
  } finally {
    // Limpieza de prueba
    if (provisionedTenantId) {
      console.log('\n🧹 Limpiando recursos temporales del tenant de prueba...');
      try {
        const pgAdmin = new Client({
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          database: 'postgres',
          user: process.env.DB_USER || 'fcsadmin',
          password: process.env.DB_PASSWORD,
        });
        await pgAdmin.connect();
        // Terminar conexiones activas
        await pgAdmin.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${testDbName}' AND pid <> pg_backend_pid();
        `);
        await pgAdmin.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
        await pgAdmin.end();

        // Borrar membership y tenant en Master
        await masterDb.delete(masterMemberships).where(eq(masterMemberships.tenant_id, provisionedTenantId));
        await masterDb.delete(masterTenants).where(eq(masterTenants.id, provisionedTenantId));

        // Borrar identidad de prueba en Master
        const identities = await masterDb.select().from(masterIdentities).where(eq(masterIdentities.email, testAdminEmail));
        if (identities.length > 0) {
          await masterDb.delete(masterIdentities).where(eq(masterIdentities.id, identities[0].id));
        }

        // Borrar carpeta de prueba
        const testUploadsDir = path.resolve(__dirname, '../../uploads/tenants', provisionedTenantId);
        if (fs.existsSync(testUploadsDir)) {
          fs.rmSync(testUploadsDir, { recursive: true, force: true });
        }
        console.log('✅ Recursos temporales eliminados correctamente.');
      } catch (cleanErr: any) {
        console.warn('⚠️ Advertencia durante limpieza:', cleanErr.message);
      }
    }
  }

  // ----------------------------------------------------
  // RESUMEN
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL FASE 4: ${passed} Pasadas | ${failed} Fallidas`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error('💥 Error inesperado en suite de pruebas de Fase 4:', err);
  process.exit(1);
});
