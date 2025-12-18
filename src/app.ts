import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { errorHandler } from './utils/response.utils';

// Importar rutas de módulos
import authRoutes from './modules/auth/auth.routes';
import areasRoutes from './modules/areas/areas.routes';
import metodosRoutes from './modules/metodos/metodos.routes';
import sedesRoutes from './modules/sedes/sedes.routes';
import tiposClienteRoutes from './modules/tipos-cliente/tipos-cliente.routes';
import analisisRoutes from './modules/analisis/analisis.routes';
import componentesRoutes from './modules/componentes/componentes.routes';
import tarifariosRoutes from './modules/tarifarios/tarifarios.routes';
import conveniosRoutes from './modules/convenios/convenios.routes';
import ordenesRoutes from './modules/ordenes/ordenes.routes';
import resultadosRoutes from './modules/resultados/resultados.routes';
import muestrasRoutes from './modules/muestras/muestras.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';
import sistemaRoutes from './modules/sistema/sistema.routes';
import reportesRoutes from './modules/reportes/reportes.routes';
import rolesRoutes from './modules/roles/roles.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';

dotenv.config();

const app: Application = express();

// ============================================
// MIDDLEWARES
// ============================================

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Rutas de módulos
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
