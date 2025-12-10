import { Router } from 'express';
import { muestrasController } from './muestras.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createMuestraSchema,
  updateMuestraSchema,
  getMuestraByIdSchema,
  deleteMuestraSchema,
} from './muestras.schema';

const router = Router();

router.get('/', muestrasController.getAll.bind(muestrasController));
router.get('/active', muestrasController.getActive.bind(muestrasController));
router.get('/:id', validate(getMuestraByIdSchema), muestrasController.getById.bind(muestrasController));
router.post('/', validate(createMuestraSchema), muestrasController.create.bind(muestrasController));
router.put('/:id', validate(updateMuestraSchema), muestrasController.update.bind(muestrasController));
router.delete('/:id', validate(deleteMuestraSchema), muestrasController.delete.bind(muestrasController));

export default router;
