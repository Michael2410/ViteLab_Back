import { Router } from 'express';
import { historialLaboralController } from './historial.controller';
import { requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// Historial laboral por colaborador
router.get('/:id/historial', requirePermission('personal.historial.read'), historialLaboralController.getByPersonalId);
router.post('/:id/historial', requirePermission('personal.historial.create'), historialLaboralController.registrarEvento);

export default router;
