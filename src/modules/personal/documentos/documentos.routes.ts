import { Router } from 'express';
import { documentosController } from './documentos.controller';
import { requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// Listado de documentos laborales emitidos
router.get('/', requirePermission('personal.documentos.read'), documentosController.getAll);

// Obtener por ID
router.get('/:id', requirePermission('personal.documentos.read'), documentosController.getById);

// Generar y registrar nuevo documento
router.post('/generar', requirePermission('personal.documentos.create'), documentosController.generar);

// Eliminar documento
router.delete('/:id', requirePermission('personal.documentos.delete'), documentosController.delete);

export default router;
