import { Router } from 'express';
import { tarifariosController } from './tarifarios.controller';
import { validate } from '../../middleware/validate.middleware';
import {
  createTarifarioSchema,
  updateTarifarioSchema,
  getTarifarioByIdSchema,
  deleteTarifarioSchema,
  createTarifarioPrecioSchema,
  updateTarifarioPrecioSchema,
  deleteTarifarioPrecioSchema,
} from './tarifarios.schema';

const router = Router();

// Tarifarios
router.get('/', tarifariosController.getAll.bind(tarifariosController));
router.get('/active', tarifariosController.getActive.bind(tarifariosController));
router.get('/:id', validate(getTarifarioByIdSchema), tarifariosController.getById.bind(tarifariosController));
router.post('/', validate(createTarifarioSchema), tarifariosController.create.bind(tarifariosController));
router.put('/:id', validate(updateTarifarioSchema), tarifariosController.update.bind(tarifariosController));
router.delete('/:id', validate(deleteTarifarioSchema), tarifariosController.delete.bind(tarifariosController));

// Precios
router.post('/precios', validate(createTarifarioPrecioSchema), tarifariosController.createPrecio.bind(tarifariosController));
router.put('/precios/:id', validate(updateTarifarioPrecioSchema), tarifariosController.updatePrecio.bind(tarifariosController));
router.delete('/precios/:id', validate(deleteTarifarioPrecioSchema), tarifariosController.deletePrecio.bind(tarifariosController));

export default router;
