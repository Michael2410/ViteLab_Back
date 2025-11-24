import { Router } from 'express';
import { resultadosController } from './resultados.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createResultadoSchema,
  bulkResultadosSchema,
  updateResultadoSchema,
  getResultadoByIdSchema,
  getResultadosByOrdenSchema,
  getResultadosFilterSchema,
  deleteResultadoSchema,
} from './resultados.schema';

const router = Router();

/**
 * @swagger
 * /api/resultados/orden/{ordenId}:
 *   get:
 *     summary: Obtener orden con todos sus análisis y resultados
 *     tags: [Resultados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ordenId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orden con resultados obtenida exitosamente
 */
router.get(
  '/orden/:ordenId',
  validate(getResultadosByOrdenSchema),
  resultadosController.getByOrden.bind(resultadosController)
);

/**
 * @swagger
 * /api/resultados:
 *   get:
 *     summary: Obtener resultados con filtros
 *     tags: [Resultados]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orden_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: orden_analisis_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: componente_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de resultados
 */
router.get(
  '/',
  validate(getResultadosFilterSchema),
  resultadosController.getAll.bind(resultadosController)
);

/**
 * @swagger
 * /api/resultados/{id}:
 *   get:
 *     summary: Obtener resultado por ID
 *     tags: [Resultados]
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
 *         description: Resultado encontrado
 */
router.get(
  '/:id',
  validate(getResultadoByIdSchema),
  resultadosController.getById.bind(resultadosController)
);

/**
 * @swagger
 * /api/resultados:
 *   post:
 *     summary: Crear resultado individual
 *     tags: [Resultados]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orden_analisis_id
 *               - componente_id
 *               - valor
 *             properties:
 *               orden_analisis_id:
 *                 type: integer
 *               componente_id:
 *                 type: integer
 *               valor:
 *                 type: string
 *               unidad_medida:
 *                 type: string
 *               observaciones:
 *                 type: string
 *     responses:
 *       201:
 *         description: Resultado creado exitosamente
 */
router.post(
  '/',
  validate(createResultadoSchema),
  resultadosController.create.bind(resultadosController)
);

/**
 * @swagger
 * /api/resultados/bulk:
 *   post:
 *     summary: Crear múltiples resultados y actualizar orden a CON_RESULTADOS
 *     tags: [Resultados]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orden_id
 *               - resultados
 *             properties:
 *               orden_id:
 *                 type: integer
 *               resultados:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     orden_analisis_id:
 *                       type: integer
 *                     componente_id:
 *                       type: integer
 *                     valor:
 *                       type: string
 *                     unidad_medida:
 *                       type: string
 *                     observaciones:
 *                       type: string
 *     responses:
 *       201:
 *         description: Resultados creados exitosamente
 */
router.post(
  '/bulk',
  validate(bulkResultadosSchema),
  resultadosController.createBulk.bind(resultadosController)
);

/**
 * @swagger
 * /api/resultados/{id}:
 *   put:
 *     summary: Actualizar resultado
 *     tags: [Resultados]
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
 *               valor:
 *                 type: string
 *               unidad_medida:
 *                 type: string
 *               observaciones:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resultado actualizado exitosamente
 */
router.put(
  '/:id',
  validate(updateResultadoSchema),
  resultadosController.update.bind(resultadosController)
);

/**
 * @swagger
 * /api/resultados/{id}:
 *   delete:
 *     summary: Eliminar resultado
 *     tags: [Resultados]
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
 *         description: Resultado eliminado exitosamente
 */
router.delete(
  '/:id',
  validate(deleteResultadoSchema),
  resultadosController.delete.bind(resultadosController)
);

export default router;
