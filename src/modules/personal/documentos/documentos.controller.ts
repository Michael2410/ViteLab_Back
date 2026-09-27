import { Request, Response } from 'express';
import { documentosService } from './documentos.service';
import { TipoDocumentoLaboral } from './documentos.types';
import { successResponse, errorResponse, asyncHandler } from '../../../utils/response.utils';

export class DocumentosController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { personal_id, tipo_documento, search } = req.query;

      const items = await documentosService.getAllDocumentos({
        personal_id: personal_id ? Number(personal_id) : undefined,
        tipo_documento: tipo_documento as TipoDocumentoLaboral,
        search: search as string,
      });

      return successResponse(res, items, 'Documentos laborales obtenidos exitosamente', 200);
    } catch (error: any) {
      console.error('Error al listar documentos laborales:', error);
      return errorResponse(res, error.message || 'Error interno al listar documentos', null, 500);
    }
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const item = await documentosService.getDocumentoById(Number(id));

      if (!item) {
        return errorResponse(res, 'Documento no encontrado', null, 404);
      }

      return successResponse(res, item, 'Documento obtenido exitosamente', 200);
    } catch (error: any) {
      console.error('Error al obtener documento:', error);
      return errorResponse(res, error.message || 'Error interno del servidor', null, 500);
    }
  });

  generar = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { personal_id, tipo_documento, destinatario, incluir_remuneracion, observaciones } = req.body;
      const emitidoPorId = (req as any).user?.id || null;

      if (!personal_id || !tipo_documento) {
        return errorResponse(res, 'Faltan campos obligatorios: personal_id, tipo_documento', null, 400);
      }

      const item = await documentosService.generarDocumento(
        {
          personal_id: Number(personal_id),
          tipo_documento,
          destinatario,
          incluir_remuneracion: Boolean(incluir_remuneracion),
          observaciones,
        },
        emitidoPorId
      );

      return successResponse(res, item, 'Documento laboral generado con éxito', 201);
    } catch (error: any) {
      console.error('Error al generar documento:', error);
      return errorResponse(res, error.message || 'Error interno al generar documento', null, 500);
    }
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await documentosService.deleteDocumento(Number(id));

      if (!deleted) {
        return errorResponse(res, 'Documento no encontrado', null, 404);
      }

      return successResponse(res, null, 'Documento eliminado con éxito', 200);
    } catch (error: any) {
      console.error('Error al eliminar documento:', error);
      return errorResponse(res, error.message || 'Error interno al eliminar documento', null, 500);
    }
  });
}

export const documentosController = new DocumentosController();
