import { Router } from 'express';
import { tiposClienteController } from './tipos-cliente.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createTipoClienteSchema,
  updateTipoClienteSchema,
  getTipoClienteByIdSchema,
  deleteTipoClienteSchema,
} from './tipos-cliente.schema';

const router = Router();

router.get('/', tiposClienteController.getAll.bind(tiposClienteController));
router.get('/active', tiposClienteController.getActive.bind(tiposClienteController));
router.get('/:id', validate(getTipoClienteByIdSchema), tiposClienteController.getById.bind(tiposClienteController));
router.post('/', validate(createTipoClienteSchema), tiposClienteController.create.bind(tiposClienteController));
router.put('/:id', validate(updateTipoClienteSchema), tiposClienteController.update.bind(tiposClienteController));
router.delete('/:id', validate(deleteTipoClienteSchema), tiposClienteController.delete.bind(tiposClienteController));

export default router;
