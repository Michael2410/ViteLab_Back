import type { Request, Response } from 'express';
import { metodosService } from './metodos.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class MetodosController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const metodos = await metodosService.getAll();
      successResponse(res, metodos, 'Métodos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener métodos', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const metodo = await metodosService.getById(id);

      if (!metodo) {
        res.status(404).json({ success: false, message: 'Método no encontrado' });
        return;
      }

      successResponse(res, metodo, 'Método obtenido exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener método', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const metodo = await metodosService.create(req.body);
      successResponse(res, metodo, 'Método creado exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear método', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const metodo = await metodosService.update(id, req.body);

      if (!metodo) {
        res.status(404).json({ success: false, message: 'Método no encontrado' });
        return;
      }

      successResponse(res, metodo, 'Método actualizado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar método', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await metodosService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Método no encontrado' });
        return;
      }

      successResponse(res, null, 'Método eliminado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar método', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const metodos = await metodosService.getActive();
      successResponse(res, metodos, 'Métodos activos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener métodos activos', error);
    }
  }
}

export const metodosController = new MetodosController();
