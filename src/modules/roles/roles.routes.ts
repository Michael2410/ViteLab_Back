import { Router } from 'express';
import { rolesController } from './roles.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Obtener todos los roles
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de roles
 */
router.get('/', rolesController.getAll);

/**
 * @swagger
 * /api/roles/active:
 *   get:
 *     summary: Obtener roles activos
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de roles activos
 */
router.get('/active', rolesController.getActive);

/**
 * @swagger
 * /api/roles/permisos:
 *   get:
 *     summary: Obtener todos los permisos
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de permisos
 */
router.get('/permisos', rolesController.getAllPermisos);

/**
 * @swagger
 * /api/roles/permisos/agrupados:
 *   get:
 *     summary: Obtener permisos agrupados por módulo
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Permisos agrupados
 */
router.get('/permisos/agrupados', rolesController.getPermisosAgrupados);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Obtener rol por ID
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol encontrado
 *       404:
 *         description: Rol no encontrado
 */
router.get('/:id', rolesController.getById);

/**
 * @swagger
 * /api/roles/{id}/permisos:
 *   get:
 *     summary: Obtener IDs de permisos de un rol
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de IDs de permisos
 */
router.get('/:id/permisos', rolesController.getPermisosByRol);

/**
 * @swagger
 * /api/roles:
 *   post:
 *     summary: Crear nuevo rol
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - permisos
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               permisos:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       201:
 *         description: Rol creado
 */
router.post('/', rolesController.create);

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Actualizar rol
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol actualizado
 */
router.put('/:id', rolesController.update);

/**
 * @swagger
 * /api/roles/{id}:
 *   delete:
 *     summary: Eliminar rol
 *     tags: [Roles]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rol eliminado
 */
router.delete('/:id', rolesController.delete);

export default router;
