import { Router } from 'express';
import { personalCatalogosController } from './personal-catalogos.controller';
import { requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// Cargos
router.get('/cargos', personalCatalogosController.getCargos);
router.get('/cargos/:id', personalCatalogosController.getCargoById);
router.post('/cargos', requirePermission('personal.catalogos.manage'), personalCatalogosController.createCargo);
router.put('/cargos/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.updateCargo);
router.delete('/cargos/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.deleteCargo);

// Áreas
router.get('/areas', personalCatalogosController.getAreas);
router.get('/areas/:id', personalCatalogosController.getAreaById);
router.post('/areas', requirePermission('personal.catalogos.manage'), personalCatalogosController.createArea);
router.put('/areas/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.updateArea);
router.delete('/areas/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.deleteArea);

// Tipos de Contrato
router.get('/tipos-contrato', personalCatalogosController.getTiposContrato);
router.get('/tipos-contrato/:id', personalCatalogosController.getTipoContratoById);
router.post('/tipos-contrato', requirePermission('personal.catalogos.manage'), personalCatalogosController.createTipoContrato);
router.put('/tipos-contrato/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.updateTipoContrato);
router.delete('/tipos-contrato/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.deleteTipoContrato);

// Motivos de Cese
router.get('/motivos-cese', personalCatalogosController.getMotivosCese);
router.get('/motivos-cese/:id', personalCatalogosController.getMotivoCeseById);
router.post('/motivos-cese', requirePermission('personal.catalogos.manage'), personalCatalogosController.createMotivoCese);
router.put('/motivos-cese/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.updateMotivoCese);
router.delete('/motivos-cese/:id', requirePermission('personal.catalogos.manage'), personalCatalogosController.deleteMotivoCese);

export default router;
