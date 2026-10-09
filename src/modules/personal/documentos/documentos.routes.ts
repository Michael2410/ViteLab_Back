import { Router } from 'express';
import { documentosController } from './documentos.controller';
import { plantillasController } from './plantillas.controller';
import { requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// ============================================
// 1. PLANTILLAS DE DOCUMENTOS (CONFIGURABLES)
// ============================================
router.get('/plantillas', plantillasController.getAll);
router.get('/plantillas/tipo/:tipo', plantillasController.getByTipo);
router.get('/plantillas/:id', plantillasController.getById);
router.post('/plantillas', requirePermission('configuracion.plantillas.manage'), plantillasController.create);
router.put('/plantillas/:id', requirePermission('configuracion.plantillas.manage'), plantillasController.update);
router.delete('/plantillas/:id', requirePermission('configuracion.plantillas.manage'), plantillasController.delete);

// ============================================
// 2. DOCUMENTOS LABORALES EMITIDOS
// ============================================
router.get('/', requirePermission('personal.documentos.read'), documentosController.getAll);
router.get('/:id', requirePermission('personal.documentos.read'), documentosController.getById);
router.post('/generar', requirePermission('personal.documentos.create'), documentosController.generar);
router.delete('/:id', requirePermission('personal.documentos.delete'), documentosController.delete);

export default router;
