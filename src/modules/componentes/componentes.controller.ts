import type { Request, Response } from 'express';
import { componentesService } from './componentes.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class ComponentesController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const componentes = await componentesService.getAll();
      successResponse(res, componentes, 'Componentes obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener componentes', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const componentes = await componentesService.getActive();
      successResponse(res, componentes, 'Componentes activos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener componentes activos', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const componente = await componentesService.getById(id);

      if (!componente) {
        res.status(404).json({ success: false, message: 'Componente no encontrado' });
        return;
      }

      successResponse(res, componente, 'Componente obtenido exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener componente', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const componente = await componentesService.create(req.body);
      successResponse(res, componente, 'Componente creado exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear componente', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const componente = await componentesService.update(id, req.body);

      if (!componente) {
        res.status(404).json({ success: false, message: 'Componente no encontrado' });
        return;
      }

      successResponse(res, componente, 'Componente actualizado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar componente', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await componentesService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Componente no encontrado' });
        return;
      }

      successResponse(res, null, 'Componente eliminado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar componente', error);
    }
  }
}

export const componentesController = new ComponentesController();
