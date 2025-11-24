import { Router } from 'express';
import { ordenesController } from './ordenes.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createOrdenSchema,
  updateOrdenSchema,
  getOrdenByIdSchema,
  deleteOrdenSchema,
  updateEstadoOrdenSchema,
  getOrdenesByFiltersSchema,
  consultarDniSchema,
} from './ordenes.schema';

const router = Router();

/**
 * @swagger
 * /api/ordenes/consultar-dni/{dni}:
 *   get:
 *     summary: Consultar datos de persona por DNI
 *     tags: [Ordenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dni
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 8
 *           maxLength: 8
 *     responses:
 *       200:
 *         description: Datos del DNI obtenidos exitosamente
 *       404:
 *         description: DNI no encontrado
 */
router.get(
  '/consultar-dni/:dni',
  validate(consultarDniSchema),
  ordenesController.consultarDni.bind(ordenesController)
);

/**
 * @swagger
 * /api/ordenes:
 *   get:
 *     summary: Listar órdenes con filtros
 *     tags: [Ordenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [REGISTRADA, CON_RESULTADOS, APROBADA]
 *       - in: query
 *         name: sede_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: paciente_dni
 *         schema:
 *           type: string
 *       - in: query
 *         name: numero_orden
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de órdenes
 */
router.get(
  '/',
  ordenesController.getAll.bind(ordenesController)
);

/**
 * @swagger
 * /api/ordenes/{id}:
 *   get:
 *     summary: Obtener orden por ID
 *     tags: [Ordenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orden encontrada
 *       404:
 *         description: Orden no encontrada
 */
router.get(
  '/:id',
  validate(getOrdenByIdSchema),
  ordenesController.getById.bind(ordenesController)
);

/**
 * @swagger
 * /api/ordenes:
 *   post:
 *     summary: Crear nueva orden
 *     tags: [Ordenes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paciente
 *               - sede_id
 *               - tipo_cliente_id
 *               - analisis_ids
 *             properties:
 *               paciente:
 *                 type: object
 *                 properties:
 *                   dni:
 *                     type: string
 *                   nombres:
 *                     type: string
 *                   apellidos:
 *                     type: string
 *                   fecha_nacimiento:
 *                     type: string
 *                     format: date
 *                   sexo:
 *                     type: string
 *                     enum: [M, F]
 *                   telefono:
 *                     type: string
 *                   email:
 *                     type: string
 *                   direccion:
 *                     type: string
 *               sede_id:
 *                 type: integer
 *               tipo_cliente_id:
 *                 type: integer
 *               convenio_id:
 *                 type: integer
 *               analisis_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               observaciones:
 *                 type: string
 *     responses:
 *       201:
 *         description: Orden creada exitosamente
 */
router.post(
  '/',
  validate(createOrdenSchema),
  ordenesController.create.bind(ordenesController)
);

/**
 * @swagger
 * /api/ordenes/{id}:
 *   put:
 *     summary: Actualizar orden
 *     tags: [Ordenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sede_id:
 *                 type: integer
 *               tipo_cliente_id:
 *                 type: integer
 *               convenio_id:
 *                 type: integer
 *               observaciones:
 *                 type: string
 *     responses:
 *       200:
 *         description: Orden actualizada exitosamente
 *       404:
 *         description: Orden no encontrada
 */
router.put(
  '/:id',
  validate(updateOrdenSchema),
  ordenesController.update.bind(ordenesController)
);

/**
 * @swagger
 * /api/ordenes/{id}/estado:
 *   patch:
 *     summary: Actualizar estado de orden
 *     tags: [Ordenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [REGISTRADA, CON_RESULTADOS, APROBADA]
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente
 */
router.patch(
  '/:id/estado',
  validate(updateEstadoOrdenSchema),
  ordenesController.updateEstado.bind(ordenesController)
);

/**
 * @swagger
 * /api/ordenes/{id}:
 *   delete:
 *     summary: Eliminar orden
 *     tags: [Ordenes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orden eliminada exitosamente
 *       404:
 *         description: Orden no encontrada
 */
router.delete(
  '/:id',
  validate(deleteOrdenSchema),
  ordenesController.delete.bind(ordenesController)
);

export default router;
