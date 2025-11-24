import { Router } from 'express';
import { metodosController } from './metodos.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createMetodoSchema,
  updateMetodoSchema,
  getMetodoByIdSchema,
  deleteMetodoSchema,
} from './metodos.schema';

const router = Router();

router.get('/', metodosController.getAll.bind(metodosController));
router.get('/active', metodosController.getActive.bind(metodosController));
router.get('/:id', validate(getMetodoByIdSchema), metodosController.getById.bind(metodosController));
router.post('/', validate(createMetodoSchema), metodosController.create.bind(metodosController));
router.put('/:id', validate(updateMetodoSchema), metodosController.update.bind(metodosController));
router.delete('/:id', validate(deleteMetodoSchema), metodosController.delete.bind(metodosController));

export default router;
