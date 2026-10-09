import app from './app';
import { testConnection } from './config/database';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { whatsappService } from './modules/laboratorio/whatsapp';
import { setSocketIO } from './config/socket';
import { runInTenant, getActiveTenant } from './db/tenant-context';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP
const httpServer = createServer(app);

// Configurar Socket.io
const allowedSocketOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedSocketOrigins.includes('*') ? '*' : allowedSocketOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Manejar conexiones de Socket.io
io.on('connection', async (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  // Resolver tenant desde token de autenticación (handshake auth o query)
  let tenantIdentifier = 'vitelab_central';
  try {
    const rawToken = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (rawToken && typeof rawToken === 'string') {
      const cleanToken = rawToken.replace(/^Bearer\s+/i, '');
      const decoded = jwt.verify(cleanToken, process.env.JWT_ACCESS_SECRET || 'access_secret') as any;
      if (decoded?.tenantId) {
        tenantIdentifier = decoded.tenantId;
      }
    }
  } catch {
    // Si no hay token o es inválido, permanece en el tenant por defecto
  }

  // Unir socket a las salas privadas del tenant (tanto por UUID como por SLUG)
  let resolvedTenantId = tenantIdentifier;
  try {
    const tenant = await getActiveTenant(tenantIdentifier);
    resolvedTenantId = tenant.id;
    socket.join(`tenant:${tenant.id}`);
    socket.join(`tenant:${tenant.slug}`);
    console.log(`🔒 Socket ${socket.id} unido a salas tenant:${tenant.id} y tenant:${tenant.slug}`);
  } catch {
    socket.join(`tenant:${tenantIdentifier}`);
    socket.join(`tenant:vitelab_central`);
    console.log(`🔒 Socket ${socket.id} unido a sala fallback tenant:${tenantIdentifier}`);
  }

  // Enviar estado actual de WhatsApp al conectarse en el contexto de su tenant
  try {
    await runInTenant(resolvedTenantId, { kind: 'system', job: 'socket:whatsapp_status' }, async () => {
      const status = await whatsappService.getStatus();
      socket.emit('whatsapp:status', {
        ...status
      });
      if (status.qr) {
        socket.emit('whatsapp:qr', { qr: status.qr });
      }
    });
  } catch (err) {
    console.warn(`⚠️ Error al emitir estado inicial de WhatsApp a socket ${socket.id}:`, err);
  }

  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

// Pasar Socket.io al servicio de WhatsApp y al hub centralizado
whatsappService.setSocketIO(io);
setSocketIO(io);

// Iniciar servidor
const startServer = async () => {
  try {
    // Verificar conexión a la base de datos
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('❌ No se pudo conectar a la base de datos. Abortando inicio del servidor.');
      process.exit(1);
    }

    // Iniciar servidor HTTP con Socket.io
    httpServer.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     🧪 ViteLab API - LIMS                 ║
║                                            ║
║     🚀 Server running on port ${PORT}        ║
║     📚 Docs: http://localhost:${PORT}/api-docs ║
║     🔌 Socket.io: Enabled                  ║
║     🌍 Environment: ${process.env.NODE_ENV || 'development'}       ║
║                                            ║
╚════════════════════════════════════════════╝
      `);
    });

    // Intentar reconectar WhatsApp si hay sesión guardada (aislado en contexto tenant)
    setTimeout(async () => {
      try {
        await runInTenant('vitelab_central', { kind: 'system', job: 'whatsapp:startup_reconnect' }, async () => {
          const status = await whatsappService.getStatus();
          if (!status.isConnected) {
            console.log('🔄 Intentando reconectar WhatsApp...');
            await whatsappService.tryReconnect();
          }
        });
      } catch (err) {
        console.log('ℹ️ No hay sesión de WhatsApp guardada o error al reconectar:', err);
      }
    }, 3000);

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('unhandledRejection', (err: Error) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err: Error) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Iniciar
startServer();
