import { Router } from 'express';
import { areasController } from './areas.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createAreaSchema,
  updateAreaSchema,
  getAreaByIdSchema,
  deleteAreaSchema,
} from './areas.schema';

const router = Router();

/**
 * @swagger
 * /api/areas:
 *   get:
 *     summary: Obtener todas las áreas
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de áreas
 */
router.get('/', areasController.getAll.bind(areasController));

/**
 * @swagger
 * /api/areas/active:
 *   get:
 *     summary: Obtener áreas activas
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de áreas activas
 */
router.get('/active', areasController.getActive.bind(areasController));

/**
 * @swagger
 * /api/areas/{id}:
 *   get:
 *     summary: Obtener área por ID
 *     tags: [Areas]
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
 *         description: Área encontrada
 *       404:
 *         description: Área no encontrada
 */
router.get(
  '/:id',
  validate(getAreaByIdSchema),
  areasController.getById.bind(areasController)
);

/**
 * @swagger
 * /api/areas:
 *   post:
 *     summary: Crear nueva área
 *     tags: [Areas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *     responses:
 *       201:
 *         description: Área creada exitosamente
 */
router.post(
  '/',
  validate(createAreaSchema),
  areasController.create.bind(areasController)
);

/**
 * @swagger
 * /api/areas/{id}:
 *   put:
 *     summary: Actualizar área
 *     tags: [Areas]
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
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Área actualizada exitosamente
 *       404:
 *         description: Área no encontrada
 */
router.put(
  '/:id',
  validate(updateAreaSchema),
  areasController.update.bind(areasController)
);

/**
 * @swagger
 * /api/areas/{id}:
 *   delete:
 *     summary: Eliminar área
 *     tags: [Areas]
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
 *         description: Área eliminada exitosamente
 *       404:
 *         description: Área no encontrada
 */
router.delete(
  '/:id',
  validate(deleteAreaSchema),
  areasController.delete.bind(areasController)
);

export default router;
