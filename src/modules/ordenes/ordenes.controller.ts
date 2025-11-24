import type { Request, Response } from 'express';
import { ordenesService } from './ordenes.service';
import { dniApiService } from './dni-api.service';
import { successResponse, errorResponse } from '../../utils/response.utils';
import type { EstadoOrden } from './ordenes.types';

export class OrdenesController {
  // Consultar DNI desde API externa
  async consultarDni(req: Request, res: Response): Promise<void> {
    try {
      const { dni } = req.params;
      const resultado = await dniApiService.consultarDni(dni);

      if (!resultado.success) {
        res.status(404).json({
          success: false,
          message: resultado.message || 'No se encontraron datos para el DNI',
        });
        return;
      }

      successResponse(res, resultado.data, 'Datos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al consultar DNI', error);
    }
  }

  // Crear nueva orden
  async create(req: Request, res: Response): Promise<void> {
    try {
      const usuarioId = req.user?.userId;
      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado' });
        return;
      }

      const orden = await ordenesService.createOrden(req.body, usuarioId);
      successResponse(res, orden, 'Orden creada exitosamente', 201);
    } catch (error: any) {
      errorResponse(res, error.message || 'Error al crear orden', error);
    }
  }

  // Obtener orden por ID
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const orden = await ordenesService.getOrdenById(id);
      successResponse(res, orden, 'Orden obtenida exitosamente');
    } catch (error: any) {
      if (error.message === 'Orden no encontrada') {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      errorResponse(res, 'Error al obtener orden', error);
    }
  }

  // Listar órdenes con filtros
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      console.log('📋 [ORDENES] Recibiendo petición GET /api/ordenes');
      console.log('📋 [ORDENES] Query params:', req.query);
      
      const filters = {
        estado: req.query.estado as EstadoOrden | undefined,
        sede_id: req.query.sede_id ? parseInt(req.query.sede_id as string) : undefined,
        fecha_desde: req.query.fecha_desde ? new Date(req.query.fecha_desde as string) : undefined,
        fecha_hasta: req.query.fecha_hasta ? new Date(req.query.fecha_hasta as string) : undefined,
        paciente_dni: req.query.paciente_dni as string | undefined,
        numero_orden: req.query.numero_orden as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      console.log('📋 [ORDENES] Filtros procesados:', filters);
      const result = await ordenesService.getOrdenes(filters);
      console.log('📋 [ORDENES] Resultado obtenido:', { total: result.total, items: result.items.length });
      console.log('✅ [ORDENES] Enviando respuesta exitosa');
      successResponse(res, result, 'Órdenes obtenidas exitosamente');
    } catch (error) {
      console.error('❌ [ORDENES] Error al obtener órdenes:', error);
      errorResponse(res, 'Error al obtener órdenes', error);
    }
  }

  // Actualizar orden
  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const orden = await ordenesService.updateOrden(id, req.body);
      successResponse(res, orden, 'Orden actualizada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar orden', error);
    }
  }

  // Actualizar estado de orden
  async updateEstado(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { estado } = req.body;
      const usuarioId = req.user?.userId;

      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado' });
        return;
      }

      const orden = await ordenesService.updateEstadoOrden(id, estado, usuarioId);
      successResponse(res, orden, `Orden marcada como ${estado} exitosamente`);
    } catch (error) {
      errorResponse(res, 'Error al actualizar estado de orden', error);
    }
  }

  // Eliminar orden
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await ordenesService.deleteOrden(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Orden no encontrada' });
        return;
      }

      successResponse(res, null, 'Orden eliminada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar orden', error);
    }
  }
}

export const ordenesController = new OrdenesController();
