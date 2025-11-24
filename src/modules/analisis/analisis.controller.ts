import type { Request, Response } from 'express';
import { analisisService } from './analisis.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class AnalisisController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const analisis = await analisisService.getAll();
      successResponse(res, analisis, 'Análisis obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener análisis', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const analisis = await analisisService.getByIdWithComponents(id);

      if (!analisis) {
        res.status(404).json({ success: false, message: 'Análisis no encontrado' });
        return;
      }

      successResponse(res, analisis, 'Análisis obtenido exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener análisis', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const analisis = await analisisService.create(req.body);
      successResponse(res, analisis, 'Análisis creado exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear análisis', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const analisis = await analisisService.update(id, req.body);

      if (!analisis) {
        res.status(404).json({ success: false, message: 'Análisis no encontrado' });
        return;
      }

      successResponse(res, analisis, 'Análisis actualizado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar análisis', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await analisisService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Análisis no encontrado' });
        return;
      }

      successResponse(res, null, 'Análisis eliminado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar análisis', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const analisis = await analisisService.getActive();
      successResponse(res, analisis, 'Análisis activos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener análisis activos', error);
    }
  }

  async search(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const analisis = await analisisService.search(query);
      successResponse(res, analisis, 'Búsqueda completada');
    } catch (error) {
      errorResponse(res, 'Error al buscar análisis', error);
    }
  }
}

export const analisisController = new AnalisisController();
