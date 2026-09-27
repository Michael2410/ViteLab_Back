import { Request, Response } from 'express';
import { historialLaboralService } from './historial.service';
import { successResponse, errorResponse, asyncHandler } from '../../../utils/response.utils';

export class HistorialLaboralController {
  /**
   * GET /api/personal/:id/historial
   * Obtener historial laboral de un colaborador
   */
  getByPersonalId = asyncHandler(async (req: Request, res: Response) => {
    const personalId = parseInt(req.params.id);
    if (isNaN(personalId)) {
      return errorResponse(res, 'ID de colaborador inválido', null, 400);
    }

    try {
      const historial = await historialLaboralService.getByPersonalId(personalId);
      return successResponse(res, historial, 'Historial laboral obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * POST /api/personal/:id/historial
   * Registrar evento manual en el historial laboral
   */
  registrarEvento = asyncHandler(async (req: Request, res: Response) => {
    const personalId = parseInt(req.params.id);
    if (isNaN(personalId)) {
      return errorResponse(res, 'ID de colaborador inválido', null, 400);
    }

    const { tipo_evento, fecha_evento, cargo, area, tipo_contrato, sueldo_base, motivo_cese_id, motivo_cese_texto, observaciones } = req.body;

    if (!tipo_evento || !fecha_evento) {
      return errorResponse(res, 'El tipo de evento y la fecha son obligatorios', null, 400);
    }

    try {
      const userId = (req as any).user?.id || null;
      const nuevoEvento = await historialLaboralService.registrarEvento(
        {
          personal_id: personalId,
          tipo_evento,
          fecha_evento,
          cargo,
          area,
          tipo_contrato,
          sueldo_base,
          motivo_cese_id,
          motivo_cese_texto,
          observaciones,
        },
        userId
      );
      return successResponse(res, nuevoEvento, 'Evento registrado en el historial laboral', 201);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });
}

export const historialLaboralController = new HistorialLaboralController();
