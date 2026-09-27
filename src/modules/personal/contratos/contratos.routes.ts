import { Router } from 'express';
import { contratosController } from './contratos.controller';
import { requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// Listado general de contratos (con soporte de alertas y filtros)
router.get('/', requirePermission('personal.contratos.read'), contratosController.getAll);

// Operaciones específicas por contrato ID
router.get('/:id', requirePermission('personal.contratos.read'), contratosController.getById);
router.put('/:id', requirePermission('personal.contratos.update'), contratosController.update);
router.delete('/:id', requirePermission('personal.contratos.delete'), contratosController.delete);
router.post('/:id/renovar', requirePermission('personal.contratos.update'), contratosController.renovar);

export default router;
