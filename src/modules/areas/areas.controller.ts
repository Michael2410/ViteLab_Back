import type { Request, Response } from 'express';
import { areasService } from './areas.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class AreasController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const areas = await areasService.getAll();
      successResponse(res, areas, 'Áreas obtenidas exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener áreas', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const area = await areasService.getById(id);

      if (!area) {
        res.status(404).json({
          success: false,
          message: 'Área no encontrada',
        });
        return;
      }

      successResponse(res, area, 'Área obtenida exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener área', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const area = await areasService.create(req.body);
      successResponse(res, area, 'Área creada exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear área', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const area = await areasService.update(id, req.body);

      if (!area) {
        res.status(404).json({
          success: false,
          message: 'Área no encontrada',
        });
        return;
      }

      successResponse(res, area, 'Área actualizada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar área', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await areasService.delete(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Área no encontrada',
        });
        return;
      }

      successResponse(res, null, 'Área eliminada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar área', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const areas = await areasService.getActive();
      successResponse(res, areas, 'Áreas activas obtenidas exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener áreas activas', error);
    }
  }
}

export const areasController = new AreasController();
