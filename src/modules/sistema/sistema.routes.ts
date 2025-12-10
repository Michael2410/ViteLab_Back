import { Router } from 'express';
import { sistemaController } from './sistema.controller';
import { authenticateToken } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateConfiguracionSchema } from './sistema.schema';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Sistema
 *   description: Configuración del sistema
 */

/**
 * @swagger
 * /api/sistema/configuracion:
 *   get:
 *     summary: Obtener configuración del sistema
 *     tags: [Sistema]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración obtenida exitosamente
 */
router.get(
  '/configuracion',
  authenticateToken,
  sistemaController.getConfiguracion.bind(sistemaController)
);

/**
 * @swagger
 * /api/sistema/configuracion:
 *   put:
 *     summary: Actualizar configuración del sistema
 *     tags: [Sistema]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               empresa_nombre:
 *                 type: string
 *               empresa_razon_social:
 *                 type: string
 *               empresa_ruc:
 *                 type: string
 *               empresa_direccion:
 *                 type: string
 *               empresa_telefono:
 *                 type: string
 *               empresa_email:
 *                 type: string
 *               empresa_web:
 *                 type: string
 *               logo_principal:
 *                 type: string
 *               logo_secundario:
 *                 type: string
 *               moneda:
 *                 type: string
 *               igv_porcentaje:
 *                 type: number
 *     responses:
 *       200:
 *         description: Configuración actualizada exitosamente
 */
router.put(
  '/configuracion',
  authenticateToken,
  validate(updateConfiguracionSchema),
  sistemaController.updateConfiguracion.bind(sistemaController)
);

/**
 * @swagger
 * /api/sistema/dashboard:
 *   get:
 *     summary: Obtener estadísticas del dashboard por sede
 *     tags: [Sistema]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 */
router.get(
  '/dashboard',
  authenticateToken,
  sistemaController.getDashboardStats.bind(sistemaController)
);

export default router;
