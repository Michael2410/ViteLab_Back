import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import {
  listarProveedoresSchema,
  proveedorIdSchema,
  crearProveedorSchema,
  actualizarProveedorSchema,
} from './proveedores.schema';
import { almacenProveedoresController as c } from './proveedores.controller';

const router = Router();

router.get('/', requirePermission('almacen.proveedores.read'), validar(listarProveedoresSchema), c.listar);
router.get('/:id', requirePermission('almacen.proveedores.read'), validar(proveedorIdSchema), c.obtener);
router.post('/', requirePermission('almacen.proveedores.create'), validar(crearProveedorSchema), c.crear);
router.put('/:id', requirePermission('almacen.proveedores.update'), validar(actualizarProveedorSchema), c.actualizar);
router.delete('/:id', requirePermission('almacen.proveedores.delete'), validar(proveedorIdSchema), c.desactivar);

export default router;
