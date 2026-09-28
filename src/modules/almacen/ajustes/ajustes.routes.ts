import { Router } from 'express';
import { requirePermission } from '../../../middleware/auth.middleware';
import { validar } from '../shared/almacen.validate';
import { cargarContextoAlmacen } from '../shared/almacen.contexto';
import {
  ajusteIdSchema,
  crearAjusteSchema,
  aprobarAjusteSchema,
  rechazarAjusteSchema,
  listarAjustesSchema,
} from './ajustes.schema';
import { ajustesController as c } from './ajustes.controller';

const router = Router();

router.use(cargarContextoAlmacen);

router.get('/', requirePermission('almacen.ajustes.read'), validar(listarAjustesSchema), c.listar);
router.get('/:id', requirePermission('almacen.ajustes.read'), validar(ajusteIdSchema), c.obtener);
router.post('/', requirePermission('almacen.ajustes.create'), validar(crearAjusteSchema), c.crear);
router.post('/:id/aprobar', requirePermission('almacen.ajustes.approve'), validar(aprobarAjusteSchema), c.aprobar);
router.post('/:id/rechazar', requirePermission('almacen.ajustes.approve'), validar(rechazarAjusteSchema), c.rechazar);

export default router;
