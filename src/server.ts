import app from './app';
import { testConnection } from './config/database';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { whatsappService } from './modules/whatsapp';
import { setSocketIO } from './config/socket';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP
const httpServer = createServer(app);

// Configurar Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Manejar conexiones de Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);
  
  // Enviar estado actual de WhatsApp al conectarse
  whatsappService.getStatus().then((status) => {
    socket.emit('whatsapp:status', {
      state: whatsappService.getConnectionState(),
      ...status
    });
  });
  
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

    // Intentar reconectar WhatsApp si hay sesión guardada
    setTimeout(async () => {
      try {
        const status = await whatsappService.getStatus();
        if (!status.isConnected) {
          console.log('🔄 Intentando reconectar WhatsApp...');
          await whatsappService.tryReconnect();
        }
      } catch (err) {
        console.log('ℹ️ No hay sesión de WhatsApp guardada');
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
