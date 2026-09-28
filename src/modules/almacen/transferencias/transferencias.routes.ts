import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  transferenciaIdSchema,
  crearTransferenciaSchema,
  recibirTransferenciaSchema,
  anularTransferenciaSchema,
  listarTransferenciasSchema,
} from './transferencias.schema';
import { transferenciasController as c } from './transferencias.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.transferencias.read'), validar(listarTransferenciasSchema), c.listar);
router.get('/:id', requirePermission('almacen.transferencias.read'), validar(transferenciaIdSchema), c.obtener);
router.post('/', requirePermission('almacen.transferencias.create'), validar(crearTransferenciaSchema), c.crear);
router.post('/:id/recibir', requirePermission('almacen.transferencias.approve'), validar(recibirTransferenciaSchema), c.recibir);
router.post('/:id/anular', requirePermission('almacen.transferencias.delete'), validar(anularTransferenciaSchema), c.anular);

export default router;
