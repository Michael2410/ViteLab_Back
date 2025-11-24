import type { Request, Response } from 'express';
import { conveniosService } from './convenios.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class ConveniosController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const convenios = await conveniosService.getAll();
      successResponse(res, convenios, 'Convenios obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener convenios', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const convenio = await conveniosService.getById(id);

      if (!convenio) {
        res.status(404).json({ success: false, message: 'Convenio no encontrado' });
        return;
      }

      successResponse(res, convenio, 'Convenio obtenido exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener convenio', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const convenio = await conveniosService.create(req.body);
      successResponse(res, convenio, 'Convenio creado exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear convenio', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const convenio = await conveniosService.update(id, req.body);

      if (!convenio) {
        res.status(404).json({ success: false, message: 'Convenio no encontrado' });
        return;
      }

      successResponse(res, convenio, 'Convenio actualizado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar convenio', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await conveniosService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Convenio no encontrado' });
        return;
      }

      successResponse(res, null, 'Convenio eliminado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar convenio', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const convenios = await conveniosService.getActive();
      successResponse(res, convenios, 'Convenios activos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener convenios activos', error);
    }
  }
}

export const conveniosController = new ConveniosController();
