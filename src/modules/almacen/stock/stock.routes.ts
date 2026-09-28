import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import { stockParamsSchema, kardexParamsSchema } from './stock.schema';
import { almacenStockController as c } from './stock.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.stock.read'), validar(stockParamsSchema), c.listarStock);
router.get('/kardex', requirePermission('almacen.kardex.read'), validar(kardexParamsSchema), c.listarKardex);

export default router;
