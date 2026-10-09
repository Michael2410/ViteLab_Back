import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { io as ClientIO } from 'socket.io-client';
import app from '../app';
import { setSocketIO, emitEvent } from '../config/socket';
import { Server as SocketIOServer } from 'socket.io';
import { generateSignedFileToken } from '../utils/file-token.utils';
import { publicLinksService } from '../modules/public-links/public-links.service';
import { tenantConnectionManager } from '../db/connection-manager';

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO PRUEBAS DE ACEPTACIÓN - FASE 3 (AISLAMIENTO)');
  console.log('====================================================');

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  setSocketIO(io);

  io.on('connection', (socket) => {
    let tenantId = 'vitelab_central';
    try {
      const rawToken = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (rawToken) {
        const decoded = jwt.verify(rawToken, process.env.JWT_ACCESS_SECRET || 'access_secret') as any;
        if (decoded?.tenantId) {
          tenantId = decoded.tenantId;
        }
      }
    } catch {}

    socket.join(`tenant:${tenantId}`);
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`🌐 Servidor iniciado para pruebas en ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  const uploadDir = path.join(__dirname, '../../uploads');

  try {
    // ----------------------------------------------------
    // PRUEBA 1: AISLAMIENTO FÍSICO DE ARCHIVOS Y MULTI-TENANT (Prueba 7 de Sección 31)
    // ----------------------------------------------------
    console.log('\n[PRUEBA 1] Aislamiento de Archivos entre Tenants y Anti-Path Traversal...');

    const tenantA = 'vitelab_central';
    const tenantB = 'tenant_beta_test';

    const dirA = path.join(uploadDir, 'tenants', tenantA, 'firmas');
    const dirB = path.join(uploadDir, 'tenants', tenantB, 'firmas');
    fs.mkdirSync(dirA, { recursive: true });
    fs.mkdirSync(dirB, { recursive: true });

    const fileA = 'firma_medico_a.png';
    const fileB = 'firma_medico_b.png';
    fs.writeFileSync(path.join(dirA, fileA), 'CONTENIDO_CONFIDENCIAL_CLINICA_A');
    fs.writeFileSync(path.join(dirB, fileB), 'CONTENIDO_CONFIDENCIAL_CLINICA_B');

    const tokenTenantA = jwt.sign(
      { userId: 1, sub: 'identity-a', tenantId: tenantA, scope: 'tenant' },
      process.env.JWT_ACCESS_SECRET || 'access_secret'
    );
    const tokenTenantB = jwt.sign(
      { userId: 2, sub: 'identity-b', tenantId: tenantB, scope: 'tenant' },
      process.env.JWT_ACCESS_SECRET || 'access_secret'
    );

    // 1a. Tenant A pide su propio archivo -> 200 OK
    const resA = await axios.get(`${baseUrl}/uploads/firmas/${fileA}`, {
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    if (resA.status === 200 && resA.data === 'CONTENIDO_CONFIDENCIAL_CLINICA_A') {
      console.log('✅ ÉXITO 1a: Tenant A descargó su archivo legítimo.');
      passed++;
    } else {
      console.error('❌ FALLÓ 1a: No se pudo descargar archivo propio de Tenant A');
      failed++;
    }

    // 1b. Tenant A intenta descargar archivo confidencial de Tenant B -> 404
    try {
      await axios.get(`${baseUrl}/uploads/firmas/${fileB}`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      console.error('❌ FALLÓ 1b: Tenant A pudo acceder al archivo de Tenant B!');
      failed++;
    } catch (err: any) {
      if (err.response?.status === 404) {
        console.log('✅ ÉXITO 1b: Tenant A fue bloqueado (404) al intentar acceder a archivo de Tenant B.');
        passed++;
      } else {
        console.error('❌ FALLÓ 1b: Respuesta inesperada:', err.response?.status);
        failed++;
      }
    }

    // 1c. Intento de Path Traversal (../..) -> Rechazado (403 o 404)
    try {
      await axios.get(`${baseUrl}/uploads/firmas/..%2f..%2fpackage.json`, {
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      console.error('❌ FALLÓ 1c: El ataque de Path Traversal tuvo éxito!');
      failed++;
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        console.log('✅ ÉXITO 1c: Intento de Path Traversal bloqueado de forma segura.');
        passed++;
      } else {
        console.error('❌ FALLÓ 1c: Respuesta inesperada:', err.response?.status);
        failed++;
      }
    }

    // 1d. URL firmada HMAC válida -> 200 OK
    const validHmacToken = generateSignedFileToken(tenantA, 'firmas', fileA, 300);
    const resHmac = await axios.get(`${baseUrl}/uploads/firmas/${fileA}?tenant=${tenantA}&token=${validHmacToken}`);
    if (resHmac.status === 200 && resHmac.data === 'CONTENIDO_CONFIDENCIAL_CLINICA_A') {
      console.log('✅ ÉXITO 1d: URL firmada HMAC temporal descargó el recurso correctamente sin requerir header.');
      passed++;
    } else {
      console.error('❌ FALLÓ 1d: Error al validar URL firmada');
      failed++;
    }

    // 1e. URL firmada HMAC alterada o falsa -> Rechazado (401)
    try {
      await axios.get(`${baseUrl}/uploads/firmas/${fileA}?tenant=${tenantA}&token=9999999999.invalido1234567890`);
      console.error('❌ FALLÓ 1e: Token HMAC adulterado fue aceptado!');
      failed++;
    } catch (err: any) {
      if (err.response?.status === 401) {
        console.log('✅ ÉXITO 1e: Token HMAC adulterado fue rechazado con 401 Unauthorized.');
        passed++;
      } else {
        console.error('❌ FALLÓ 1e:', err.response?.status);
        failed++;
      }
    }

    // ----------------------------------------------------
    // PRUEBA 2: IGNORAR TENANT_ID ENVIADO POR EL CLIENTE (Prueba 3 de Sección 31)
    // ----------------------------------------------------
    console.log('\n[PRUEBA 2] Blindaje contra manipulación de tenant_id en query/headers...');
    // Cuando el usuario autenticado con Tenant A envía ?tenant_id=tenantB, el backend
    // debe usar estrictamente el tenant del JWT validado
    const queryTamperRes = await axios.get(`${baseUrl}/uploads/firmas/${fileA}?tenant_id=${tenantB}`, {
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        'X-Tenant-Id': tenantB,
      },
    });
    if (queryTamperRes.status === 200 && queryTamperRes.data === 'CONTENIDO_CONFIDENCIAL_CLINICA_A') {
      console.log('✅ ÉXITO 2: Parámetros tenant_id en query y cabeceras fueron ignorados; el contexto del JWT gobernó la consulta.');
      passed++;
    } else {
      console.error('❌ FALLÓ 2: El parámetro cliente interfirió con la autorización.');
      failed++;
    }

    // ----------------------------------------------------
    // PRUEBA 3: AISLAMIENTO DE WEBSOCKETS (Prueba 6 de Sección 31)
    // ----------------------------------------------------
    console.log('\n[PRUEBA 3] Aislamiento de eventos de Socket.IO por sala de tenant...');
    const clientA = ClientIO(baseUrl, {
      auth: { token: tokenTenantA },
      transports: ['websocket'],
    });

    const clientB = ClientIO(baseUrl, {
      auth: { token: tokenTenantB },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
      new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
    ]);

    let clientAReceivedEvent = false;
    let clientBReceivedEvent = false;

    clientA.on('alerta:clinica', () => {
      clientAReceivedEvent = true;
    });

    clientB.on('alerta:clinica', () => {
      clientBReceivedEvent = true;
    });

    // Emitir evento exclusivamente a la sala de Tenant B
    emitEvent('alerta:clinica', { msg: 'Alerta privada para clínica B' }, tenantB);

    await new Promise((resolve) => setTimeout(resolve, 300));

    clientA.disconnect();
    clientB.disconnect();

    if (!clientAReceivedEvent && clientBReceivedEvent) {
      console.log('✅ ÉXITO 3: El evento emitido a Tenant B fue recibido ÚNICAMENTE por el socket de Tenant B. Cliente A no recibió nada.');
      passed++;
    } else {
      console.error('❌ FALLÓ 3: Fuga de evento en sockets:', { clientAReceivedEvent, clientBReceivedEvent });
      failed++;
    }

    // ----------------------------------------------------
    // PRUEBA 4: ENLACES PÚBLICOS OPACOS (Sección 21)
    // ----------------------------------------------------
    console.log('\n[PRUEBA 4] Enlaces Públicos Opacos y Validación...');
    const createdLink = await publicLinksService.createLink({
      tenantId: '7215783f-18a3-48c8-a6b3-4eeed19eaf63',
      purpose: 'REPORT_VERIFY',
      resourceType: 'orden',
      resourceId: 'ORD-100234',
      expiresInHours: 24,
    });

    const resolved = await publicLinksService.resolveLink(createdLink.token);
    if (resolved.resourceId === 'ORD-100234' && resolved.purpose === 'REPORT_VERIFY') {
      console.log('✅ ÉXITO 4a: Enlace público opaco creado y resuelto exitosamente sin exponer el ID de tenant en la URL.');
      passed++;
    } else {
      console.error('❌ FALLÓ 4a: Error al resolver enlace público:', resolved);
      failed++;
    }

    // Revocar enlace y comprobar rechazo
    await publicLinksService.revokeLink(createdLink.token);
    try {
      await publicLinksService.resolveLink(createdLink.token);
      console.error('❌ FALLÓ 4b: El enlace revocado debió haber sido rechazado!');
      failed++;
    } catch (err: any) {
      if (err.message.includes('revocado')) {
        console.log('✅ ÉXITO 4b: Enlace revocado fue rechazado correctamente.');
        passed++;
      } else {
        console.error('❌ FALLÓ 4b: Excepción inesperada:', err.message);
        failed++;
      }
    }

    // Limpieza de archivos de prueba
    fs.rmSync(path.join(uploadDir, 'tenants', tenantA), { recursive: true, force: true });
    fs.rmSync(path.join(uploadDir, 'tenants', tenantB), { recursive: true, force: true });

  } catch (err) {
    console.error('❌ Error fatal en pruebas de aislamiento:', err);
    failed++;
  } finally {
    server.close();
    await tenantConnectionManager.closeAll();
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL FASE 3: ${passed} Pasadas | ${failed} Fallidas`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
