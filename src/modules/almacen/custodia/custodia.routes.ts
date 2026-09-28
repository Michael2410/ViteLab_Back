import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import { listarCustodiaSchema } from './custodia.schema';
import { custodiaController as c } from './custodia.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.custodia.read'), validar(listarCustodiaSchema), c.listar);
router.get('/resumen', requirePermission('almacen.custodia.read'), c.resumen);

export default router;
