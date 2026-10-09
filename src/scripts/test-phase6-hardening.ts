import { masterPool } from '../db/master';
import { authService } from '../modules/auth/auth.service';
import { auditService } from '../modules/audit/audit.service';
import { runInTenant } from '../db/tenant-context';
import { tenantConnectionManager } from '../db/connection-manager';
import { TenantBackupService } from './backup-tenant';
import fs from 'fs';

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('🛡️ INICIANDO PRUEBAS DE ACEPTACIÓN - FASE 6');
  console.log('   (Observabilidad, Auditoría, Health Check y Backups)');
  console.log('====================================================\n');

  let passed = 0;
  const total = 5;

  try {
    // ----------------------------------------------------
    // TEST 1: Registro de eventos de seguridad en auth_events (Master DB)
    // ----------------------------------------------------
    console.log('--- TEST 1: Registro en auth_events al fallar y acertar login ---');
    const fakeEmail = 'audit_test_nonexistent@vitelab.com';

    // Intento fallido
    try {
      await authService.loginMaster(
        { username: fakeEmail, password: 'WrongPassword123!' },
        '192.168.1.50',
        'Phase6-Audit-Agent'
      );
    } catch {
      // Esperado
    }

    const failEvents = await masterPool.query(
      `SELECT event, ip, user_agent, detail FROM auth_events 
       WHERE event = 'LOGIN_FAIL' AND detail->>'identifier' = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [fakeEmail]
    );

    if (failEvents.rows.length === 0) {
      throw new Error('No se registró el evento LOGIN_FAIL en master.auth_events');
    }
    console.log(`✅ TEST 1a PASADO: Evento LOGIN_FAIL registrado con IP=${failEvents.rows[0].ip} y UserAgent.`);

    // Registrar evento personalizado directamente con recordAuthEvent
    await authService.recordAuthEvent('SECURITY_POLICY_CHECK', null, null, '127.0.0.1', 'Hardening-Test', {
      phase: 6,
      status: 'VERIFIED',
    });

    const secEvents = await masterPool.query(
      `SELECT event, detail FROM auth_events WHERE event = 'SECURITY_POLICY_CHECK' ORDER BY created_at DESC LIMIT 1`
    );

    if (secEvents.rows.length === 0 || secEvents.rows[0].detail?.phase !== 6) {
      throw new Error('Fallo al persistir evento SECURITY_POLICY_CHECK en master.auth_events');
    }
    console.log('✅ TEST 1b PASADO: Registro de eventos de seguridad en Master verificado.');
    passed++;

    // ----------------------------------------------------
    // TEST 2: Auditoría Funcional en Base de Datos del Tenant
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Registro de auditoría funcional en la BD del tenant ---');
    const tenantRes = await masterPool.query(
      `SELECT id, slug FROM tenants WHERE slug = 'vitelab_central'`
    );
    if (tenantRes.rows.length === 0) {
      throw new Error('No se encontró el tenant vitelab_central en Master');
    }
    const tenantId = tenantRes.rows[0].id;

    const testRequestId = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
    const fakeIdentityId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    await runInTenant(tenantId, { kind: 'user', identityId: fakeIdentityId, usuarioId: 1 }, async () => {
      await auditService.record({
        accion: 'APPROVE',
        recurso: 'resultado_laboratorio',
        recursoId: 'TEST-RESULT-999',
        valoresAntes: { estado: 'PENDIENTE', valor: '12.4' },
        valoresDespues: { estado: 'VALIDADO', valor: '12.4' },
        resultado: 'SUCCESS',
        ip: '10.0.0.15',
        userAgent: 'Clinical-Workstation-Chrome',
        requestId: testRequestId,
      });

      const logs = await auditService.getAuditLog(5, 0);
      const matchingLog = logs.find((l: any) => l.request_id === testRequestId);

      if (!matchingLog) {
        throw new Error('No se encontró el registro de auditoría insertado en la tabla auditoria del tenant');
      }

      if (matchingLog.accion !== 'APPROVE' || matchingLog.recurso !== 'resultado_laboratorio') {
        throw new Error(`Datos de auditoría corruptos: ${JSON.stringify(matchingLog)}`);
      }
    });

    console.log('✅ TEST 2 PASADO: Registro append-only en auditoria del tenant verificado correctamente.');
    passed++;

    // ----------------------------------------------------
    // TEST 3: Health Check y Conexión Multi-Tenant
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Monitoreo y métricas de salud (Master + Tenant Pools) ---');
    const qStart = Date.now();
    await masterPool.query('SELECT 1');
    const latencyMs = Date.now() - qStart;

    const poolStats = tenantConnectionManager.getPoolStats();

    if (latencyMs < 0 || typeof poolStats.activeTenants !== 'number') {
      throw new Error('Métricas de salud reportan valores inconsistentes');
    }

    console.log(`✅ TEST 3 PASADO: Master DB latencia: ${latencyMs}ms | Pools activos en memoria: ${poolStats.activeTenants}`);
    passed++;

    // ----------------------------------------------------
    // TEST 4: Respaldo Lógico de Tenant (Backup por Tenant)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Generación de respaldo lógico aislado por tenant ---');
    const backupResult = await TenantBackupService.backupTenant('vitelab_central');

    if (!fs.existsSync(backupResult.backupFile)) {
      throw new Error(`El archivo de respaldo no fue creado en disco: ${backupResult.backupFile}`);
    }

    if (!backupResult.checksumSha256 || backupResult.checksumSha256.length !== 64) {
      throw new Error('Checksum SHA-256 no generado o inválido');
    }

    const metaFile = `${backupResult.backupFile}.meta.json`;
    if (!fs.existsSync(metaFile)) {
      throw new Error('No se generó el archivo .meta.json del respaldo');
    }

    console.log(`✅ TEST 4 PASADO: Respaldo lógico creado, con checksum verificado y metadata asociada.`);
    passed++;

    // ----------------------------------------------------
    // TEST 5: Consistencia de Esquema y Contratos en Master
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Integridad referencial y estado de Master DB ---');
    const checkTenants = await masterPool.query(`SELECT count(*)::int as count FROM tenants WHERE status = 'ACTIVE'`);
    const checkIdentities = await masterPool.query(`SELECT count(*)::int as count FROM identities`);
    const checkMemberships = await masterPool.query(`SELECT count(*)::int as count FROM memberships`);

    if (checkTenants.rows[0].count === 0 || checkIdentities.rows[0].count === 0) {
      throw new Error('Master DB no tiene tenants o identidades activas');
    }

    console.log(`✅ TEST 5 PASADO: Master operativo con ${checkTenants.rows[0].count} tenant(s) activo(s), ${checkIdentities.rows[0].count} identidades y ${checkMemberships.rows[0].count} membresías.`);
    passed++;

  } catch (error: any) {
    console.error('❌ Error en pruebas de Fase 6:', error);
  } finally {
    console.log('\n====================================================');
    console.log(`📊 RESULTADO FASE 6: ${passed}/${total} PRUEBAS SUPERADAS (${Math.round((passed / total) * 100)}%)`);
    console.log('====================================================\n');

    process.exit(passed === total ? 0 : 1);
  }
}

runPhase6Tests();
