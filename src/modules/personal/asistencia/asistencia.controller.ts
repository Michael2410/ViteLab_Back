import { Request, Response } from 'express';
import { asistenciaService } from './asistencia.service';
import { EstadoAsistencia } from './asistencia.types';
import { successResponse, errorResponse, asyncHandler } from '../../../utils/response.utils';

export class AsistenciaController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { fecha, fecha_desde, fecha_hasta, personal_id, estado, search } = req.query;

      const items = await asistenciaService.getAllAsistencia({
        fecha: fecha as string,
        fecha_desde: fecha_desde as string,
        fecha_hasta: fecha_hasta as string,
        personal_id: personal_id ? Number(personal_id) : undefined,
        estado: estado as EstadoAsistencia,
        search: search as string,
      });

      return successResponse(res, items, 'Registros de asistencia obtenidos exitosamente', 200);
    } catch (error: any) {
      console.error('Error al listar asistencia:', error);
      return errorResponse(res, error.message || 'Error interno al listar asistencia', null, 500);
    }
  });

  registrar = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { personal_id, fecha, hora_entrada, hora_salida, minutos_tardanza, estado, justificacion, sede_id } = req.body;
      const usuarioRegistroId = (req as any).user?.id || null;

      if (!personal_id || !fecha || !estado) {
        return errorResponse(res, 'Faltan campos obligatorios: personal_id, fecha, estado', null, 400);
      }

      const item = await asistenciaService.registrarAsistencia(
        {
          personal_id: Number(personal_id),
          fecha,
          hora_entrada,
          hora_salida,
          minutos_tardanza: minutos_tardanza ? Number(minutos_tardanza) : 0,
          estado,
          justificacion,
          sede_id: sede_id ? Number(sede_id) : null,
        },
        usuarioRegistroId
      );

      return successResponse(res, item, 'Asistencia registrada con éxito', 201);
    } catch (error: any) {
      console.error('Error al registrar asistencia:', error);
      return errorResponse(res, error.message || 'Error interno al registrar asistencia', null, 500);
    }
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { hora_entrada, hora_salida, minutos_tardanza, estado, justificacion, sede_id, fecha } = req.body;
      const usuarioRegistroId = (req as any).user?.id || null;

      const item = await asistenciaService.updateAsistencia(
        Number(id),
        {
          hora_entrada,
          hora_salida,
          minutos_tardanza: minutos_tardanza !== undefined ? Number(minutos_tardanza) : undefined,
          estado,
          justificacion,
          sede_id: sede_id ? Number(sede_id) : undefined,
          fecha,
        },
        usuarioRegistroId
      );

      if (!item) {
        return errorResponse(res, 'Registro de asistencia no encontrado', null, 404);
      }

      return successResponse(res, item, 'Asistencia actualizada con éxito', 200);
    } catch (error: any) {
      console.error('Error al actualizar asistencia:', error);
      return errorResponse(res, error.message || 'Error interno al actualizar asistencia', null, 500);
    }
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await asistenciaService.deleteAsistencia(Number(id));

      if (!deleted) {
        return errorResponse(res, 'Registro de asistencia no encontrado', null, 404);
      }

      return successResponse(res, null, 'Registro de asistencia eliminado con éxito', 200);
    } catch (error: any) {
      console.error('Error al eliminar asistencia:', error);
      return errorResponse(res, error.message || 'Error interno al eliminar registro', null, 500);
    }
  });
}

export const asistenciaController = new AsistenciaController();
