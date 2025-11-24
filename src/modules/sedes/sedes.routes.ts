import { Router } from 'express';
import { sedesController } from './sedes.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createSedeSchema,
  updateSedeSchema,
  getSedeByIdSchema,
  deleteSedeSchema,
} from './sedes.schema';

const router = Router();

router.get('/', sedesController.getAll.bind(sedesController));
router.get('/active', sedesController.getActive.bind(sedesController));
router.get('/:id', validate(getSedeByIdSchema), sedesController.getById.bind(sedesController));
router.post('/', validate(createSedeSchema), sedesController.create.bind(sedesController));
router.put('/:id', validate(updateSedeSchema), sedesController.update.bind(sedesController));
router.delete('/:id', validate(deleteSedeSchema), sedesController.delete.bind(sedesController));

export default router;
