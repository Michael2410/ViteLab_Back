import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { masterDb, masterIdentities, masterTenants, masterMemberships } from '../db/master';
import { db, usuarios, roles } from '../db';
import { authService } from '../modules/auth/auth.service';
import { eq, and } from 'drizzle-orm';
import { runInTenant } from '../db/tenant-context';

dotenv.config();

async function runTest() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO TEST: FLUJO DE RESETEO Y PRIMER LOGIN');
  console.log('======================================================\n');

  const testEmail = `test_pwd_reset_${Date.now()}@vitelab.test`;
  const initialPassword = 'InitialPass123!';
  const newPersonalPassword = 'PersonalPass456!';

  let testTenantId: string | null = null;
  let testUserId: number | null = null;
  let testIdentityId: string | null = null;

  try {
    // 1. Obtener tenant principal activo
    const [tenant] = await masterDb
      .select()
      .from(masterTenants)
      .where(eq(masterTenants.status, 'ACTIVE'))
      .limit(1);

    if (!tenant) {
      throw new Error('No se encontró ningún tenant activo en vitelab_master');
    }
    testTenantId = tenant.id;
    console.log(`✅ [1/7] Usando tenant activo: ${tenant.name} (${tenant.slug})`);

    // 2. Crear usuario simulando creación por Administrador
    await runInTenant(tenant.id, { kind: 'system', job: 'test:create-user' }, async () => {
      // Obtener rol
      const [rol] = await db.select().from(roles).limit(1);

      const createdUser = await authService.createUser({
        username: `user_${Date.now()}`,
        email: testEmail,
        password: initialPassword,
        rol_id: rol.id,
      });

      testUserId = createdUser.id;
    });

    // Verificar en Master DB que must_change_password sea TRUE
    const [identity] = await masterDb
      .select()
      .from(masterIdentities)
      .where(eq(masterIdentities.email, testEmail.toLowerCase().trim()));

    if (!identity) throw new Error('No se creó la identidad en Master DB');
    testIdentityId = identity.id;

    if (!identity.must_change_password) {
      throw new Error('❌ FALLO: must_change_password NO está en true tras crear el usuario');
    }
    console.log('✅ [2/7] Usuario creado exitosamente con must_change_password = true');

    // 3. Simular primer Login del usuario con la contraseña inicial
    console.log('🔄 [3/7] Probando login con contraseña inicial...');
    const loginResult = await authService.login({
      username: testEmail,
      password: initialPassword,
    });

    if (!('requiresPasswordChange' in loginResult) || !loginResult.requiresPasswordChange) {
      throw new Error('❌ FALLO: El login no devolvió requiresPasswordChange: true');
    }

    if (!loginResult.tempToken) {
      throw new Error('❌ FALLO: El login no devolvió tempToken para cambiar clave');
    }

    console.log('✅ [3/7] Login interceptado correctamente. requiresPasswordChange = true, tempToken emitido');

    // 4. Intentar cambiar por la misma contraseña (debe rechazar)
    console.log('🔄 [4/7] Probando validación: cambiar a la misma contraseña inicial (debe fallar)...');
    try {
      await authService.changeInitialPassword(loginResult.tempToken, initialPassword);
      throw new Error('❌ FALLO: Debió rechazar el uso de la misma contraseña provisional');
    } catch (err: any) {
      if (err.message.includes('diferente')) {
        console.log('✅ [4/7] Rechazo correcto de contraseña idéntica a la provisional');
      } else {
        throw err;
      }
    }

    // 5. Cambiar a una contraseña personal nueva
    console.log('🔄 [5/7] Cambiando a contraseña personal válida...');
    const changeResult = await authService.changeInitialPassword(
      loginResult.tempToken,
      newPersonalPassword
    );

    const resAny = changeResult as any;
    const isSuccessChange =
      Boolean(resAny.accessToken) ||
      Boolean(resAny.requires2FA && resAny.setupNeeded) ||
      Boolean(resAny.requiresTenantSelection);

    if (!isSuccessChange) {
      throw new Error(`❌ FALLO: Respuesta inesperada tras cambiar la contraseña: ${JSON.stringify(changeResult)}`);
    }

    // Verificar que must_change_password ahora sea FALSE en Master DB
    const [updatedIdentity] = await masterDb
      .select()
      .from(masterIdentities)
      .where(eq(masterIdentities.id, testIdentityId));

    if (updatedIdentity.must_change_password !== false) {
      throw new Error('❌ FALLO: must_change_password sigue en true tras cambiar la contraseña');
    }
    console.log('✅ [5/7] Contraseña actualizada exitosamente. must_change_password ahora es false');

    // 6. Probar segundo Login:
    // a) Con la clave vieja inicial (debe fallar)
    // b) Con la nueva clave (debe entrar directo sin pedir cambio)
    console.log('🔄 [6/7] Verificando login post-cambio...');
    try {
      await authService.login({ username: testEmail, password: initialPassword });
      throw new Error('❌ FALLO: La clave vieja sigue funcionando');
    } catch (err: any) {
      console.log('   ✓ Login con clave vieja rechazado correctamente');
    }

    const secondLoginResult = await authService.login({
      username: testEmail,
      password: newPersonalPassword,
    });

    if ('requiresPasswordChange' in secondLoginResult && secondLoginResult.requiresPasswordChange) {
      throw new Error('❌ FALLO: Volvió a pedir cambio de clave en un login habitual');
    }

    const isSecondLoginValid =
      ('accessToken' in secondLoginResult) ||
      ('requires2FA' in secondLoginResult) ||
      ('requiresTenantSelection' in secondLoginResult);

    if (!isSecondLoginValid) {
      throw new Error('❌ FALLO: No emitió sesión válida en el segundo login');
    }
    console.log('✅ [6/7] Login normal exitoso con la nueva clave personal (sin exigir cambio de clave)');

    // 7. Probar Reseteo por Administrador
    console.log('🔄 [7/7] Probando reseteo de clave por Administrador...');
    let tempPassGenerated = '';
    await runInTenant(tenant.id, { kind: 'system', job: 'test:admin-reset' }, async () => {
      const resetResult = await authService.adminResetPassword(testUserId!);
      tempPassGenerated = resetResult.temporaryPassword;
    });

    // Verificar que en Master volvió a must_change_password = true
    const [resetIdentity] = await masterDb
      .select()
      .from(masterIdentities)
      .where(eq(masterIdentities.id, testIdentityId));

    if (!resetIdentity.must_change_password) {
      throw new Error('❌ FALLO: must_change_password no se activó tras el reseteo por el admin');
    }

    // Login con la clave provisional generada por el admin
    const resetLoginResult = await authService.login({
      username: testEmail,
      password: tempPassGenerated,
    });

    if (!('requiresPasswordChange' in resetLoginResult) || !resetLoginResult.requiresPasswordChange) {
      throw new Error('❌ FALLO: Tras el reseteo del admin, el usuario no fue obligado a cambiar clave');
    }
    console.log('✅ [7/7] Reseteo por Administrador completado: vuelve a exigir cambio obligatorio');

    console.log('\n======================================================');
    console.log('🎉 TODOS LOS TESTS DE RESETEO Y PRIMER LOGIN PASARON EXITOSAMENTE (7/7)');
    console.log('======================================================\n');
  } catch (error: any) {
    console.error('\n❌ ERROR EN TEST:', error.message);
    process.exit(1);
  } finally {
    // Limpieza de datos de prueba
    if (testIdentityId) {
      try {
        await masterDb.delete(masterMemberships).where(eq(masterMemberships.identity_id, testIdentityId));
        await masterDb.delete(masterIdentities).where(eq(masterIdentities.id, testIdentityId));
      } catch {}
    }
    if (testTenantId && testUserId) {
      try {
        await runInTenant(testTenantId, { kind: 'system', job: 'test:cleanup' }, async () => {
          await db.delete(usuarios).where(eq(usuarios.id, testUserId!));
        });
      } catch {}
    }
    process.exit(0);
  }
}

runTest();
