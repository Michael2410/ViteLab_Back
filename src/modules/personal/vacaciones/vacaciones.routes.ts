import { Router } from 'express';
import { vacacionesController } from './vacaciones.controller';
import { requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// Listado de solicitudes de vacaciones
router.get('/', requirePermission('personal.vacaciones.read'), vacacionesController.getAll);

// Obtener por ID
router.get('/:id', requirePermission('personal.vacaciones.read'), vacacionesController.getById);

// Registrar nueva solicitud
router.post('/', requirePermission('personal.vacaciones.create'), vacacionesController.create);

// Aprobar / Rechazar / Cambiar estado de solicitud
router.put('/:id/estado', requirePermission('personal.vacaciones.approve'), vacacionesController.cambiarEstado);

// Eliminar solicitud
router.delete('/:id', requirePermission('personal.vacaciones.delete'), vacacionesController.delete);

export default router;
