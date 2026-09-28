import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  ingresoIdSchema,
  crearIngresoSchema,
  anularIngresoSchema,
  listarIngresosSchema,
} from './ingresos.schema';
import { almacenIngresosController as c } from './ingresos.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.ingresos.read'), validar(listarIngresosSchema), c.listar);
router.get('/:id', requirePermission('almacen.ingresos.read'), validar(ingresoIdSchema), c.obtener);
router.post('/', requirePermission('almacen.ingresos.create'), validar(crearIngresoSchema), c.crear);
router.post('/:id/anular', requirePermission('almacen.ingresos.delete'), validar(anularIngresoSchema), c.anular);

export default router;
