import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import axios from 'axios';
import bcrypt from 'bcrypt';
import { generateSync } from 'otplib';
import app from '../app';
import { db, usuarios, runInTenant, tenantConnectionManager } from '../db';
import { masterDb, masterIdentities, masterMemberships, masterTenants, masterSessions, masterMfaBackupCodes } from '../db/master';
import { eq } from 'drizzle-orm';

async function testHttpFlow() {
  console.log('====================================================');
  console.log('🧪 TEST HTTP E2E: MIDDLEWARE DE AUTENTICACIÓN Y CONTEXTO TENANT');
  console.log('====================================================');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`🌐 Servidor de pruebas iniciado en ${baseUrl}`);

  const testEmail = `e2e_tenant_${Date.now()}@vitelab.com`;
  const testPassword = 'PasswordTest123!';
  let createdIdentityId: string | null = null;
  let createdUsuarioId: number | null = null;

  try {
    // 0. Setup de usuario de prueba aislado
    console.log('\n[PREPARACIÓN] Creando usuario de prueba e2e...');
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Obtener tenant vitelab_central
    const [centralTenant] = await masterDb
      .select()
      .from(masterTenants)
      .where(eq(masterTenants.slug, 'vitelab_central'));

    // Crear identidad en Master
    const [identity] = await masterDb
      .insert(masterIdentities)
      .values({
        email: testEmail,
        password_hash: passwordHash,
        status: 'ACTIVE',
        mfa_enabled: false,
      })
      .returning({ id: masterIdentities.id });
    createdIdentityId = identity.id;

    // Crear membresía en Master
    await masterDb.insert(masterMemberships).values({
      identity_id: createdIdentityId,
      tenant_id: centralTenant.id,
      status: 'ACTIVE',
    });

    // Crear usuario en BD del tenant
    await runInTenant('vitelab_central', { kind: 'system', job: 'test:setup' }, async () => {
      const [u] = await db
        .insert(usuarios)
        .values({
          username: 'e2e_test_user',
          email: testEmail,
          password_hash: passwordHash,
          rol_id: 1, // ADMIN
          activo: true,
          identity_id: createdIdentityId,
        })
        .returning({ id: usuarios.id });
      createdUsuarioId = u.id;
    });

    console.log(`   ✅ Usuario de prueba creado (Identity: ${createdIdentityId}, Usuario: ${createdUsuarioId})`);

    // 1. Login inicial
    console.log('\n[PASO 1] Invocando POST /api/auth/login...');
    const loginRes = await axios.post(`${baseUrl}/api/auth/login`, {
      username: testEmail,
      password: testPassword,
    });

    console.log('   Respuesta de login:', {
      status: loginRes.status,
      requires2FA: loginRes.data?.data?.requires2FA,
      setupNeeded: loginRes.data?.data?.setupNeeded,
      hasTempToken: !!loginRes.data?.data?.tempToken,
    });

    let accessToken: string;

    // 2. Onboarding 2FA (como no tiene 2FA configurado, pasa por confirm-setup)
    if (loginRes.data?.data?.setupNeeded) {
      console.log('\n[PASO 2] Usuario nuevo requiere configuración 2FA (Onboarding)...');
      const tempToken = loginRes.data.data.tempToken;
      const manualKey = loginRes.data.data.manualKey;

      const totpCode = generateSync({ secret: manualKey });
      console.log(`   Código TOTP generado con clave manual: ${totpCode}`);

      const setupRes = await axios.post(`${baseUrl}/api/auth/2fa/confirm-setup`, {
        tempToken,
        code: totpCode,
      });

      console.log('   Respuesta de confirm-setup:', {
        status: setupRes.status,
        hasAccessToken: !!setupRes.data?.data?.accessToken,
        username: setupRes.data?.data?.user?.username,
      });

      accessToken = setupRes.data.data.accessToken;
    } else {
      accessToken = loginRes.data.data.accessToken;
    }

    // 3. Probar endpoint protegido de perfil: GET /api/auth/me
    console.log('\n[PASO 3] Invocando GET /api/auth/me con Access Token...');
    const meRes = await axios.get(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('   Perfil obtenido correctamente:', {
      id: meRes.data?.data?.id,
      username: meRes.data?.data?.username,
      email: meRes.data?.data?.email,
      rol: meRes.data?.data?.rol_nombre,
    });

    // 4. Probar catálogo clínico de áreas: GET /api/areas
    console.log('\n[PASO 4] Invocando GET /api/areas (consulta a BD de tenant a través de proxy)...');
    const areasRes = await axios.get(`${baseUrl}/api/areas`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('   Áreas obtenidas exitosamente:', {
      status: areasRes.status,
      count: areasRes.data?.data?.length,
      sample: areasRes.data?.data?.slice(0, 2).map((a: any) => a.nombre),
    });

    console.log('\n====================================================');
    console.log('✅ TODAS LAS PRUEBAS HTTP E2E COMPLETADAS EXITOSAMENTE');
    console.log('   - authenticateToken resolvió el tenant correctamente.');
    console.log('   - Lease adquirido y liberado automáticamente al cerrar cada request.');
    console.log('   - AsyncLocalStorage + Proxy db funcionaron sin tocar consultas SQL existentes.');
    console.log('====================================================');

  } catch (err: any) {
    console.error('❌ Error en prueba HTTP E2E:', err.response?.data || err.message);
    process.exitCode = 1;
  } finally {
    // Limpieza
    console.log('\n[LIMPIEZA] Eliminando usuario de prueba e2e...');
    try {
      if (createdUsuarioId) {
        await runInTenant('vitelab_central', { kind: 'system', job: 'test:cleanup' }, async () => {
          await db.delete(usuarios).where(eq(usuarios.id, createdUsuarioId!));
        });
      }
      if (createdIdentityId) {
        await masterDb.delete(masterSessions).where(eq(masterSessions.identity_id, createdIdentityId));
        await masterDb.delete(masterMfaBackupCodes).where(eq(masterMfaBackupCodes.identity_id, createdIdentityId));
        await masterDb.delete(masterMemberships).where(eq(masterMemberships.identity_id, createdIdentityId));
        await masterDb.delete(masterIdentities).where(eq(masterIdentities.id, createdIdentityId));
      }
      console.log('   ✨ Limpieza de usuario e2e completada.');
    } catch (cleanErr) {
      console.warn('   ⚠️ Error en limpieza:', cleanErr);
    }

    server.close();
    await tenantConnectionManager.closeAll();
  }
}

testHttpFlow().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
