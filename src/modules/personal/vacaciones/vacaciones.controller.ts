import { Request, Response } from 'express';
import { vacacionesService } from './vacaciones.service';
import { EstadoVacacion } from './vacaciones.types';
import { successResponse, errorResponse, asyncHandler } from '../../../utils/response.utils';

export class VacacionesController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { personal_id, estado, fecha_desde, fecha_hasta } = req.query;

      const items = await vacacionesService.getAllSolicitudes({
        personal_id: personal_id ? Number(personal_id) : undefined,
        estado: estado as EstadoVacacion,
        fecha_desde: fecha_desde as string,
        fecha_hasta: fecha_hasta as string,
      });

      return successResponse(res, items, 'Solicitudes de vacaciones obtenidas exitosamente', 200);
    } catch (error: any) {
      console.error('Error al listar vacaciones:', error);
      return errorResponse(res, error.message || 'Error interno al listar vacaciones', null, 500);
    }
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await vacacionesService.getSolicitudById(Number(id));

      if (!item) {
        return errorResponse(res, 'Solicitud de vacación no encontrada', null, 404);
      }

      return successResponse(res, item, 'Solicitud de vacación obtenida exitosamente', 200);
    } catch (error: any) {
      console.error('Error al obtener solicitud de vacación:', error);
      return errorResponse(res, error.message || 'Error interno del servidor', null, 500);
    }
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { personal_id, fecha_inicio, fecha_fin, dias_solicitados, motivo } = req.body;

      if (!personal_id || !fecha_inicio || !fecha_fin || !dias_solicitados) {
        return errorResponse(res, 'Faltan campos obligatorios: personal_id, fecha_inicio, fecha_fin, dias_solicitados', null, 400);
      }

      const item = await vacacionesService.createSolicitud({
        personal_id: Number(personal_id),
        fecha_inicio,
        fecha_fin,
        dias_solicitados: Number(dias_solicitados),
        motivo,
      });

      return successResponse(res, item, 'Solicitud de vacaciones registrada con éxito', 201);
    } catch (error: any) {
      console.error('Error al crear solicitud de vacación:', error);
      return errorResponse(res, error.message || 'Error interno al registrar solicitud de vacación', null, 500);
    }
  });

  cambiarEstado = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { estado, observaciones_aprobador } = req.body;
      const usuarioAprobadorId = (req as any).user?.id || null;

      if (!estado) {
        return errorResponse(res, 'El estado es obligatorio', null, 400);
      }

      const item = await vacacionesService.cambiarEstado(
        Number(id),
        { estado, observaciones_aprobador },
        usuarioAprobadorId
      );

      if (!item) {
        return errorResponse(res, 'Solicitud de vacación no encontrada', null, 404);
      }

      return successResponse(res, item, `Estado de solicitud actualizado a ${estado}`, 200);
    } catch (error: any) {
      console.error('Error al actualizar estado de vacación:', error);
      return errorResponse(res, error.message || 'Error interno al actualizar estado', null, 500);
    }
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await vacacionesService.deleteSolicitud(Number(id));

      if (!deleted) {
        return errorResponse(res, 'Solicitud de vacación no encontrada', null, 404);
      }

      return successResponse(res, null, 'Solicitud eliminada con éxito', 200);
    } catch (error: any) {
      console.error('Error al eliminar solicitud de vacación:', error);
      return errorResponse(res, error.message || 'Error interno al eliminar solicitud', null, 500);
    }
  });
}

export const vacacionesController = new VacacionesController();
