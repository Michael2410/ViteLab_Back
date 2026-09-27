import { Request, Response } from 'express';
import { personalCatalogosService } from './personal-catalogos.service';
import { CatalogoTipo } from './personal-catalogos.types';
import { successResponse, errorResponse, asyncHandler } from '../../../utils/response.utils';

export class PersonalCatalogosController {
  private getTipoFromRequest(req: Request): CatalogoTipo {
    const path = req.baseUrl || req.path;
    if (path.includes('cargos')) return 'cargos';
    if (path.includes('areas')) return 'areas';
    if (path.includes('tipos-contrato')) return 'tipos-contrato';
    if (path.includes('motivos-cese')) return 'motivos-cese';
    throw new Error('Catálogo no especificado');
  }

  // --- MÉTODOS GENÉRICOS ---
  getAll = (tipo: CatalogoTipo) =>
    asyncHandler(async (req: Request, res: Response) => {
      const soloActivos = req.query.activos === 'true';
      const items = await personalCatalogosService.getAll(tipo, soloActivos);
      return successResponse(res, items, 'Catálogo obtenido exitosamente', 200);
    });

  getById = (tipo: CatalogoTipo) =>
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return errorResponse(res, 'ID inválido', null, 400);

      try {
        const item = await personalCatalogosService.getById(tipo, id);
        return successResponse(res, item, 'Elemento obtenido exitosamente', 200);
      } catch (error: any) {
        return errorResponse(res, error.message, null, 404);
      }
    });

  create = (tipo: CatalogoTipo) =>
    asyncHandler(async (req: Request, res: Response) => {
      const { nombre, descripcion, activo } = req.body;
      if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
        return errorResponse(res, 'El nombre es obligatorio', null, 400);
      }

      try {
        const item = await personalCatalogosService.create(tipo, { nombre, descripcion, activo });
        return successResponse(res, item, 'Elemento creado exitosamente', 201);
      } catch (error: any) {
        return errorResponse(res, error.message, null, 400);
      }
    });

  update = (tipo: CatalogoTipo) =>
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return errorResponse(res, 'ID inválido', null, 400);

      const { nombre, descripcion, activo } = req.body;
      try {
        const item = await personalCatalogosService.update(tipo, id, { nombre, descripcion, activo });
        return successResponse(res, item, 'Elemento actualizado exitosamente', 200);
      } catch (error: any) {
        return errorResponse(res, error.message, null, 400);
      }
    });

  delete = (tipo: CatalogoTipo) =>
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return errorResponse(res, 'ID inválido', null, 400);

      try {
        const result = await personalCatalogosService.delete(tipo, id);
        return successResponse(res, result, result.message, 200);
      } catch (error: any) {
        return errorResponse(res, error.message, null, 400);
      }
    });

  // --- HANDLERS ESPECÍFICOS PARA RUTAS ---
  getCargos = this.getAll('cargos');
  getCargoById = this.getById('cargos');
  createCargo = this.create('cargos');
  updateCargo = this.update('cargos');
  deleteCargo = this.delete('cargos');

  getAreas = this.getAll('areas');
  getAreaById = this.getById('areas');
  createArea = this.create('areas');
  updateArea = this.update('areas');
  deleteArea = this.delete('areas');

  getTiposContrato = this.getAll('tipos-contrato');
  getTipoContratoById = this.getById('tipos-contrato');
  createTipoContrato = this.create('tipos-contrato');
  updateTipoContrato = this.update('tipos-contrato');
  deleteTipoContrato = this.delete('tipos-contrato');

  getMotivosCese = this.getAll('motivos-cese');
  getMotivoCeseById = this.getById('motivos-cese');
  createMotivoCese = this.create('motivos-cese');
  updateMotivoCese = this.update('motivos-cese');
  deleteMotivoCese = this.delete('motivos-cese');
}

export const personalCatalogosController = new PersonalCatalogosController();
