import { Router } from 'express';
import { conveniosController } from './convenios.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createConvenioSchema,
  updateConvenioSchema,
  getConvenioByIdSchema,
  deleteConvenioSchema,
} from './convenios.schema';

const router = Router();

router.get('/', conveniosController.getAll.bind(conveniosController));
router.get('/active', conveniosController.getActive.bind(conveniosController));
router.get('/:id', validate(getConvenioByIdSchema), conveniosController.getById.bind(conveniosController));
router.post('/', validate(createConvenioSchema), conveniosController.create.bind(conveniosController));
router.put('/:id', validate(updateConvenioSchema), conveniosController.update.bind(conveniosController));
router.delete('/:id', validate(deleteConvenioSchema), conveniosController.delete.bind(conveniosController));

export default router;
