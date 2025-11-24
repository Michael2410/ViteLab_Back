import { Router } from 'express';
import { analisisController } from './analisis.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createAnalisisSchema,
  updateAnalisisSchema,
  getAnalisisByIdSchema,
  deleteAnalisisSchema,
  searchAnalisisSchema,
} from './analisis.schema';

const router = Router();

router.get('/', analisisController.getAll.bind(analisisController));
router.get('/active', analisisController.getActive.bind(analisisController));
router.get('/search', validate(searchAnalisisSchema), analisisController.search.bind(analisisController));
router.get('/:id', validate(getAnalisisByIdSchema), analisisController.getById.bind(analisisController));
router.post('/', validate(createAnalisisSchema), analisisController.create.bind(analisisController));
router.put('/:id', validate(updateAnalisisSchema), analisisController.update.bind(analisisController));
router.delete('/:id', validate(deleteAnalisisSchema), analisisController.delete.bind(analisisController));

export default router;
