import type { Request, Response } from 'express';
import { muestrasService } from './muestras.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class MuestrasController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const muestras = await muestrasService.getAll();
      successResponse(res, muestras, 'Muestras obtenidas exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener muestras', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const muestra = await muestrasService.getById(id);

      if (!muestra) {
        res.status(404).json({ success: false, message: 'Muestra no encontrada' });
        return;
      }

      successResponse(res, muestra, 'Muestra obtenida exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener muestra', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const muestras = await muestrasService.getActive();
      successResponse(res, muestras, 'Muestras activas obtenidas exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener muestras activas', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const muestra = await muestrasService.create(req.body);
      successResponse(res, muestra, 'Muestra creada exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear muestra', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const muestra = await muestrasService.update(id, req.body);

      if (!muestra) {
        res.status(404).json({ success: false, message: 'Muestra no encontrada' });
        return;
      }

      successResponse(res, muestra, 'Muestra actualizada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar muestra', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await muestrasService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Muestra no encontrada' });
        return;
      }

      successResponse(res, null, 'Muestra eliminada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar muestra', error);
    }
  }
}

export const muestrasController = new MuestrasController();
