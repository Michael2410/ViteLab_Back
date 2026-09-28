import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  despachoIdSchema,
  crearDespachoSchema,
  anularDespachoSchema,
  listarDespachosSchema,
} from './despachos.schema';
import { despachosController as c } from './despachos.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.despachos.read'), validar(listarDespachosSchema), c.listar);
router.get('/:id', requirePermission('almacen.despachos.read'), validar(despachoIdSchema), c.obtener);
router.post('/', requirePermission('almacen.despachos.create'), validar(crearDespachoSchema), c.crear);
router.post('/:id/anular', requirePermission('almacen.despachos.delete'), validar(anularDespachoSchema), c.anular);

export default router;
