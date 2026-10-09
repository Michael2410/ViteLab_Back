import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  ordenCompraIdSchema,
  crearOrdenCompraSchema,
  anularOrdenCompraSchema,
  listarOrdenesCompraSchema,
} from './ordenes-compra.schema';
import { almacenOrdenesCompraController as c } from './ordenes-compra.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.ordenes_compra.read'), validar(listarOrdenesCompraSchema), c.listar);
router.get('/:id', requirePermission('almacen.ordenes_compra.read'), validar(ordenCompraIdSchema), c.obtener);
router.post('/', requirePermission('almacen.ordenes_compra.create'), validar(crearOrdenCompraSchema), c.crear);
router.post('/:id/anular', requirePermission('almacen.ordenes_compra.delete'), validar(anularOrdenCompraSchema), c.anular);

export default router;
