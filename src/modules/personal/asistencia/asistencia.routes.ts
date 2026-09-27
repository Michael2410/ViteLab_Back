import { Router } from 'express';
import { asistenciaController } from './asistencia.controller';
import { requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// Listado de asistencia con filtros
router.get('/', requirePermission('personal.asistencia.read'), asistenciaController.getAll);

// Registrar o marcar asistencia
router.post('/', requirePermission('personal.asistencia.create'), asistenciaController.registrar);

// Actualizar o rectificar marca de asistencia
router.put('/:id', requirePermission('personal.asistencia.update'), asistenciaController.update);

// Eliminar registro
router.delete('/:id', requirePermission('personal.asistencia.delete'), asistenciaController.delete);

export default router;
