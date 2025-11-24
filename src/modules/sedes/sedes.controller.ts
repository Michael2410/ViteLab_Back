import type { Request, Response } from 'express';
import { sedesService } from './sedes.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class SedesController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const sedes = await sedesService.getAll();
      successResponse(res, sedes, 'Sedes obtenidas exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener sedes', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const sede = await sedesService.getById(id);

      if (!sede) {
        res.status(404).json({ success: false, message: 'Sede no encontrada' });
        return;
      }

      successResponse(res, sede, 'Sede obtenida exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener sede', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const sede = await sedesService.create(req.body);
      successResponse(res, sede, 'Sede creada exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear sede', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const sede = await sedesService.update(id, req.body);

      if (!sede) {
        res.status(404).json({ success: false, message: 'Sede no encontrada' });
        return;
      }

      successResponse(res, sede, 'Sede actualizada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar sede', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await sedesService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Sede no encontrada' });
        return;
      }

      successResponse(res, null, 'Sede eliminada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar sede', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const sedes = await sedesService.getActive();
      successResponse(res, sedes, 'Sedes activas obtenidas exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener sedes activas', error);
    }
  }
}

export const sedesController = new SedesController();
