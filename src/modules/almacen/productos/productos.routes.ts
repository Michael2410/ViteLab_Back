import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { almacenProductosController as c } from './productos.controller';
import {
  listarProductosSchema,
  productoIdSchema,
  crearProductoSchema,
  actualizarProductoSchema,
} from './productos.schema';

const router = Router();

router.get('/', requirePermission('almacen.productos.read'), validar(listarProductosSchema), c.listar);
router.get('/:id', requirePermission('almacen.productos.read'), validar(productoIdSchema), c.obtener);
router.post('/', requirePermission('almacen.productos.create'), validar(crearProductoSchema), c.crear);
router.put('/:id', requirePermission('almacen.productos.update'), validar(actualizarProductoSchema), c.actualizar);
router.delete('/:id', requirePermission('almacen.productos.delete'), validar(productoIdSchema), c.desactivar);

export default router;
