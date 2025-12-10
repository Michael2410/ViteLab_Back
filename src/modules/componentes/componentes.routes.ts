import { Router } from 'express';
import { componentesController } from './componentes.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createComponenteSchema,
  updateComponenteSchema,
  getComponenteByIdSchema,
  deleteComponenteSchema,
} from './componentes.schema';

const router = Router();

router.get('/', componentesController.getAll.bind(componentesController));
router.get('/active', componentesController.getActive.bind(componentesController));
router.get('/:id', validate(getComponenteByIdSchema), componentesController.getById.bind(componentesController));
router.post('/', validate(createComponenteSchema), componentesController.create.bind(componentesController));
router.put('/:id', validate(updateComponenteSchema), componentesController.update.bind(componentesController));
router.delete('/:id', validate(deleteComponenteSchema), componentesController.delete.bind(componentesController));

export default router;
