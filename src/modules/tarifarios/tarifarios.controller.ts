import type { Request, Response } from 'express';
import { tarifariosService } from './tarifarios.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class TarifariosController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const tarifarios = await tarifariosService.getAll();
      successResponse(res, tarifarios, 'Tarifarios obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener tarifarios', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const tarifario = await tarifariosService.getByIdWithPrecios(id);

      if (!tarifario) {
        res.status(404).json({ success: false, message: 'Tarifario no encontrado' });
        return;
      }

      successResponse(res, tarifario, 'Tarifario obtenido exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener tarifario', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const tarifario = await tarifariosService.create(req.body);
      successResponse(res, tarifario, 'Tarifario creado exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear tarifario', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const tarifario = await tarifariosService.update(id, req.body);

      if (!tarifario) {
        res.status(404).json({ success: false, message: 'Tarifario no encontrado' });
        return;
      }

      successResponse(res, tarifario, 'Tarifario actualizado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar tarifario', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await tarifariosService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Tarifario no encontrado' });
        return;
      }

      successResponse(res, null, 'Tarifario eliminado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar tarifario', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const tarifarios = await tarifariosService.getActive();
      successResponse(res, tarifarios, 'Tarifarios activos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener tarifarios activos', error);
    }
  }

  // PRECIOS
  async createPrecio(req: Request, res: Response): Promise<void> {
    try {
      const precio = await tarifariosService.createPrecio(req.body);
      successResponse(res, precio, 'Precio creado exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear precio', error);
    }
  }

  async updatePrecio(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const precio = await tarifariosService.updatePrecio(id, req.body);

      if (!precio) {
        res.status(404).json({ success: false, message: 'Precio no encontrado' });
        return;
      }

      successResponse(res, precio, 'Precio actualizado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar precio', error);
    }
  }

  async deletePrecio(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await tarifariosService.deletePrecio(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Precio no encontrado' });
        return;
      }

      successResponse(res, null, 'Precio eliminado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar precio', error);
    }
  }
}

export const tarifariosController = new TarifariosController();
