import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  maestroIdSchema,
  crearUnidadSchema,
  actualizarUnidadSchema,
  crearCategoriaSchema,
  actualizarCategoriaSchema,
  listarAlmacenesSchema,
  crearAlmacenSchema,
  actualizarAlmacenSchema,
  listarUbicacionesSchema,
  crearUbicacionSchema,
  actualizarUbicacionSchema,
} from './maestros.schema';
import { almacenMaestrosController as c } from './maestros.controller';

const router = Router();

router.use(cargarContextoAlmacen);

// Unidades de medida
router.get('/unidades-medida', requirePermission('almacen.maestros.read'), c.listarUnidades);
router.post('/unidades-medida', requirePermission('almacen.maestros.manage'), validar(crearUnidadSchema), c.crearUnidad);
router.put('/unidades-medida/:id', requirePermission('almacen.maestros.manage'), validar(actualizarUnidadSchema), c.actualizarUnidad);
router.delete('/unidades-medida/:id', requirePermission('almacen.maestros.manage'), validar(maestroIdSchema), c.desactivarUnidad);

// Categorías
router.get('/categorias', requirePermission('almacen.maestros.read'), c.listarCategorias);
router.post('/categorias', requirePermission('almacen.maestros.manage'), validar(crearCategoriaSchema), c.crearCategoria);
router.put('/categorias/:id', requirePermission('almacen.maestros.manage'), validar(actualizarCategoriaSchema), c.actualizarCategoria);
router.delete('/categorias/:id', requirePermission('almacen.maestros.manage'), validar(maestroIdSchema), c.desactivarCategoria);

// Almacenes
router.get('/almacenes', requirePermission('almacen.maestros.read'), validar(listarAlmacenesSchema), c.listarAlmacenes);
router.get('/almacenes/:id', requirePermission('almacen.maestros.read'), validar(maestroIdSchema), c.obtenerAlmacen);
router.post('/almacenes', requirePermission('almacen.maestros.manage'), validar(crearAlmacenSchema), c.crearAlmacen);
router.put('/almacenes/:id', requirePermission('almacen.maestros.manage'), validar(actualizarAlmacenSchema), c.actualizarAlmacen);
router.delete('/almacenes/:id', requirePermission('almacen.maestros.manage'), validar(maestroIdSchema), c.desactivarAlmacen);

// Ubicaciones
router.get('/ubicaciones', requirePermission('almacen.maestros.read'), validar(listarUbicacionesSchema), c.listarUbicaciones);
router.post('/ubicaciones', requirePermission('almacen.maestros.manage'), validar(crearUbicacionSchema), c.crearUbicacion);
router.put('/ubicaciones/:id', requirePermission('almacen.maestros.manage'), validar(actualizarUbicacionSchema), c.actualizarUbicacion);
router.delete('/ubicaciones/:id', requirePermission('almacen.maestros.manage'), validar(maestroIdSchema), c.desactivarUbicacion);

export default router;
