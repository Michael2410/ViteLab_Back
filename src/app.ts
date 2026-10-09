import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { errorHandler } from './utils/response.utils';
import { masterPool } from './db/master';
import { tenantConnectionManager } from './db/connection-manager';

// Importar rutas de módulos
import authRoutes from './modules/auth/auth.routes';
import sedesRoutes from './modules/sedes/sedes.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';
import sistemaRoutes from './modules/sistema/sistema.routes';
import rolesRoutes from './modules/roles/roles.routes';
import personalRoutes from './modules/personal';
import { almacenRouter } from './modules/almacen';
import {
  areasRoutes,
  metodosRoutes,
  tiposClienteRoutes,
  analisisRoutes,
  componentesRoutes,
  tarifariosRoutes,
  conveniosRoutes,
  muestrasRoutes,
  ordenesRoutes,
  resultadosRoutes,
  reportesRoutes,
  whatsappRoutes,
} from './modules/laboratorio';

dotenv.config();

const app: Application = express();

// ============================================
// MIDDLEWARES
// ============================================

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (como Postman o server-to-server) o si coincide con allowedOrigins
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servido seguro y aislado de archivos por tenant (sin servido estático público)
app.use('/uploads', uploadsRoutes);

// Logs de requests (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// SWAGGER DOCUMENTATION
// ============================================

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ViteLab API - Sistema de Laboratorio Clínico',
      version: '1.0.0',
      description: 'API REST para el sistema de gestión de laboratorio clínico',
      contact: {
        name: 'ViteLab Team',
        email: 'dev@vitelab.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Servidor de desarrollo',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts'], // Archivos donde están las rutas con JSDoc
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ============================================
// RUTAS
// ============================================

// Ruta de prueba
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'ViteLab API - Sistema de Laboratorio Clínico v1.0',
    docs: '/api-docs',
  });
});

// Health check y observabilidad Multi-Tenant
app.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let masterStatus = 'healthy';
  let masterLatencyMs = 0;
  let masterError: string | null = null;

  try {
    const qStart = Date.now();
    await masterPool.query('SELECT 1');
    masterLatencyMs = Date.now() - qStart;
  } catch (err: any) {
    masterStatus = 'unhealthy';
    masterError = err.message;
  }

  const poolStats = tenantConnectionManager.getPoolStats();

  const isHealthy = masterStatus === 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    message: isHealthy ? 'ViteLab Multi-Tenant API operational' : 'Database connectivity issue',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    master: {
      status: masterStatus,
      latencyMs: masterLatencyMs,
      ...(masterError ? { error: masterError } : {}),
    },
    tenants: {
      activePools: poolStats.activeTenants,
      details: poolStats.pools,
    },
  });
});

import { tenantContextMiddleware } from './middleware/tenant-context.middleware';

// Rutas de módulos
// Enlace global de contexto tenant para solicitudes autenticadas
app.use(tenantContextMiddleware);

app.use('/api/auth', authRoutes);

// Catálogos
app.use('/api/areas', areasRoutes);
app.use('/api/metodos', metodosRoutes);
app.use('/api/sedes', sedesRoutes);
app.use('/api/tipos-cliente', tiposClienteRoutes);
app.use('/api/analisis', analisisRoutes);
app.use('/api/componentes', componentesRoutes);
app.use('/api/tarifarios', tarifariosRoutes);
app.use('/api/convenios', conveniosRoutes);
app.use('/api/muestras', muestrasRoutes);

// Módulo de Órdenes
app.use('/api/ordenes', ordenesRoutes);

// Módulo de Resultados
app.use('/api/resultados', resultadosRoutes);

// Módulo de Uploads
app.use('/api/uploads', uploadsRoutes);

// Módulo de Sistema (Configuración)
app.use('/api/sistema', sistemaRoutes);

// Módulo de Reportes
app.use('/api/reportes', reportesRoutes);

// Módulo de Roles y Permisos
app.use('/api/roles', rolesRoutes);

// Módulo de WhatsApp
app.use('/api/whatsapp', whatsappRoutes);

// Módulo de Personal (RRHH)
app.use('/api/personal', personalRoutes);

// Módulo de Almacén & Logística
app.use('/api/almacen', almacenRouter);

// ============================================
// ERROR HANDLING
// ============================================

// Ruta no encontrada
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
  });
});

// Manejador global de errores
app.use(errorHandler);

export default app;
