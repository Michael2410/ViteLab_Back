import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  pedidoIdSchema,
  crearPedidoSchema,
  aprobarPedidoSchema,
  rechazarPedidoSchema,
  anularPedidoSchema,
  listarPedidosSchema,
} from './pedidos.schema';
import { pedidosController as c } from './pedidos.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.pedidos.read'), validar(listarPedidosSchema), c.listar);
router.get('/:id', requirePermission('almacen.pedidos.read'), validar(pedidoIdSchema), c.obtener);
router.post('/', requirePermission('almacen.pedidos.create'), validar(crearPedidoSchema), c.crear);
router.post('/:id/aprobar', requirePermission('almacen.pedidos.approve'), validar(aprobarPedidoSchema), c.aprobar);
router.post('/:id/rechazar', requirePermission('almacen.pedidos.approve'), validar(rechazarPedidoSchema), c.rechazar);
router.post('/:id/anular', requirePermission('almacen.pedidos.delete'), validar(anularPedidoSchema), c.anular);

export default router;
