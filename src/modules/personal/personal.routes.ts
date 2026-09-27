import { Router } from 'express';
import { personalController } from './directorio';
import { personalCatalogosRoutes } from './catalogos';
import { historialLaboralController } from './historial';
import { contratosController, contratosRoutes } from './contratos';
import { vacacionesRoutes } from './vacaciones';
import { asistenciaRoutes } from './asistencia';
import { documentosRoutes } from './documentos';
import { authenticateToken, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// Todas las rutas de personal requieren estar autenticado
router.use(authenticateToken);

// ============================================
// 1. SUBMÓDULO: CATÁLOGOS CONFIGURABLES
// ============================================
router.use('/catalogos', personalCatalogosRoutes);

// ============================================
// 2. SUBMÓDULO: CONTRATOS (Rutas globales)
// ============================================
router.use('/contratos', contratosRoutes);

// ============================================
// 3. SUBMÓDULO: VACACIONES
// ============================================
router.use('/vacaciones', vacacionesRoutes);

// ============================================
// 4. SUBMÓDULO: ASISTENCIA Y CONTROL HORARIO
// ============================================
router.use('/asistencia', asistenciaRoutes);

// ============================================
// 5. SUBMÓDULO: DOCUMENTOS Y CERTIFICADOS LABORALES
// ============================================
router.use('/documentos', documentosRoutes);

// ============================================
// 6. HISTORIAL LABORAL POR COLABORADOR
// ============================================
router.get('/:id/historial', requirePermission('personal.historial.read'), historialLaboralController.getByPersonalId);
router.post('/:id/historial', requirePermission('personal.historial.create'), historialLaboralController.registrarEvento);

// ============================================
// 7. CONTRATOS POR COLABORADOR ESPECÍFICO
// ============================================
router.get('/:id/contratos', requirePermission('personal.contratos.read'), contratosController.getByPersonalId);
router.post('/:id/contratos', requirePermission('personal.contratos.create'), contratosController.create);

// ============================================
// 8. DIRECTORIO DE PERSONAL
// ============================================
router.get('/', requirePermission('personal.directorio.read'), personalController.getAll);
router.get('/:id', requirePermission('personal.directorio.read'), personalController.getById);
router.post('/', requirePermission('personal.directorio.create'), personalController.create);
router.put('/:id', requirePermission('personal.directorio.update'), personalController.update);
router.delete('/:id', requirePermission('personal.directorio.delete'), personalController.delete);

// Acciones de ciclo de vida (Cese / Reincorporación con log automático en historial)
router.post('/:id/dar-de-baja', requirePermission('personal.directorio.update'), personalController.darDeBaja);
router.post('/:id/reincorporar', requirePermission('personal.directorio.update'), personalController.reincorporar);

// Gestión de cuenta de sistema para personal
router.post('/:id/cuenta', requirePermission('personal.cuenta.create'), personalController.vincularCuenta);
router.put('/:id/cuenta', requirePermission('personal.cuenta.update'), personalController.updateCuenta);
router.delete('/:id/cuenta', requirePermission('personal.cuenta.delete'), personalController.desvincularCuenta);

export default router;
