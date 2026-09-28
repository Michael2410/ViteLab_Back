import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  consumoIdSchema,
  crearConsumoSchema,
  anularConsumoSchema,
  listarConsumosSchema,
  devolucionIdSchema,
  crearDevolucionSchema,
  anularDevolucionSchema,
  listarDevolucionesSchema,
} from './consumos.schema';
import { consumosController as c } from './consumos.controller';

const router = Router();

router.use(cargarContextoAlmacen);

// Consumos
router.get('/', requirePermission('almacen.consumos.read'), validar(listarConsumosSchema), c.listarConsumos);
router.get('/:id', requirePermission('almacen.consumos.read'), validar(consumoIdSchema), c.obtenerConsumo);
router.post('/', requirePermission('almacen.consumos.create'), validar(crearConsumoSchema), c.crearConsumo);
router.post('/:id/anular', requirePermission('almacen.consumos.delete'), validar(anularConsumoSchema), c.anularConsumo);

// Devoluciones
router.get('/devoluciones/todas', requirePermission('almacen.consumos.read'), validar(listarDevolucionesSchema), c.listarDevoluciones);
router.get('/devoluciones/:id', requirePermission('almacen.consumos.read'), validar(devolucionIdSchema), c.obtenerDevolucion);
router.post('/devoluciones', requirePermission('almacen.consumos.create'), validar(crearDevolucionSchema), c.crearDevolucion);
router.post('/devoluciones/:id/anular', requirePermission('almacen.consumos.delete'), validar(anularDevolucionSchema), c.anularDevolucion);

export default router;
