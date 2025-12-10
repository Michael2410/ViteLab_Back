import { Router } from 'express';
import { reportesController } from './reportes.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

/**
 * @swagger
 * tags:
 *   name: Reportes
 *   description: Reportes del sistema
 */

/**
 * @swagger
 * /api/reportes/ordenes-periodo:
 *   get:
 *     summary: Reporte de órdenes por período
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sede_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reporte generado exitosamente
 */
router.get(
  '/ordenes-periodo',
  reportesController.getOrdenesPorPeriodo.bind(reportesController)
);

/**
 * @swagger
 * /api/reportes/ingresos-sede:
 *   get:
 *     summary: Reporte de ingresos por sede
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Reporte generado exitosamente
 */
router.get(
  '/ingresos-sede',
  reportesController.getIngresosPorSede.bind(reportesController)
);

/**
 * @swagger
 * /api/reportes/analisis-ranking:
 *   get:
 *     summary: Reporte de análisis más solicitados
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Reporte generado exitosamente
 */
router.get(
  '/analisis-ranking',
  reportesController.getAnalisisRanking.bind(reportesController)
);

/**
 * @swagger
 * /api/reportes/productividad:
 *   get:
 *     summary: Reporte de productividad por usuario
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Reporte generado exitosamente
 */
router.get(
  '/productividad',
  reportesController.getProductividadUsuarios.bind(reportesController)
);

export default router;
