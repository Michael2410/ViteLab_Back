import type { Request, Response } from 'express';
import { tiposClienteService } from './tipos-cliente.service';
import { successResponse, errorResponse } from '../../utils/response.utils';

export class TiposClienteController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const tipos = await tiposClienteService.getAll();
      successResponse(res, tipos, 'Tipos de cliente obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener tipos de cliente', error);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const tipo = await tiposClienteService.getById(id);

      if (!tipo) {
        res.status(404).json({ success: false, message: 'Tipo de cliente no encontrado' });
        return;
      }

      successResponse(res, tipo, 'Tipo de cliente obtenido exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener tipo de cliente', error);
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const tipo = await tiposClienteService.create(req.body);
      successResponse(res, tipo, 'Tipo de cliente creado exitosamente', 201);
    } catch (error) {
      errorResponse(res, 'Error al crear tipo de cliente', error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const tipo = await tiposClienteService.update(id, req.body);

      if (!tipo) {
        res.status(404).json({ success: false, message: 'Tipo de cliente no encontrado' });
        return;
      }

      successResponse(res, tipo, 'Tipo de cliente actualizado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar tipo de cliente', error);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await tiposClienteService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Tipo de cliente no encontrado' });
        return;
      }

      successResponse(res, null, 'Tipo de cliente eliminado exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar tipo de cliente', error);
    }
  }

  async getActive(_req: Request, res: Response): Promise<void> {
    try {
      const tipos = await tiposClienteService.getActive();
      successResponse(res, tipos, 'Tipos de cliente activos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener tipos de cliente activos', error);
    }
  }
}

export const tiposClienteController = new TiposClienteController();
