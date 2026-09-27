import { Request, Response } from 'express';
import { contratosService } from './contratos.service';
import { successResponse, errorResponse, asyncHandler } from '../../../utils/response.utils';

export class ContratosController {
  /**
   * GET /api/personal/contratos
   * Listar todos los contratos con filtros opcionales (por_vencer, estado, etc.)
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { personal_id, estado, por_vencer, search } = req.query;

      const contratos = await contratosService.getAllContratos({
        personal_id: personal_id ? parseInt(String(personal_id)) : undefined,
        estado: estado ? (String(estado) as any) : undefined,
        por_vencer: por_vencer === 'true',
        search: search ? String(search) : undefined,
      });

      return successResponse(res, contratos, 'Contratos obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/personal/:id/contratos
   * Listar contratos de un colaborador específico
   */
  getByPersonalId = asyncHandler(async (req: Request, res: Response) => {
    const personalId = parseInt(req.params.id);
    if (isNaN(personalId)) {
      return errorResponse(res, 'ID de colaborador inválido', null, 400);
    }

    try {
      const contratos = await contratosService.getByPersonalId(personalId);
      return successResponse(res, contratos, 'Contratos del colaborador obtenidos', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/personal/contratos/:id
   * Obtener detalle de un contrato por ID
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const contrato = await contratosService.getById(id);
      return successResponse(res, contrato, 'Contrato obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  });

  /**
   * POST /api/personal/:id/contratos
   * Registrar contrato para un colaborador
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const personalId = parseInt(req.params.id);
    if (isNaN(personalId)) {
      return errorResponse(res, 'ID de colaborador inválido', null, 400);
    }

    const {
      tipo_contrato_id,
      tipo_contrato_nombre,
      numero_contrato,
      fecha_inicio,
      fecha_fin,
      es_indefinido,
      cargo,
      sueldo_pactado,
      archivo_url,
      estado,
      observaciones,
    } = req.body;

    if (!fecha_inicio) {
      return errorResponse(res, 'La fecha de inicio es obligatoria', null, 400);
    }

    try {
      const userId = (req as any).user?.id || null;
      const contrato = await contratosService.createContrato(
        {
          personal_id: personalId,
          tipo_contrato_id,
          tipo_contrato_nombre,
          numero_contrato,
          fecha_inicio,
          fecha_fin,
          es_indefinido,
          cargo,
          sueldo_pactado,
          archivo_url,
          estado,
          observaciones,
        },
        userId
      );
      return successResponse(res, contrato, 'Contrato registrado exitosamente', 201);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * PUT /api/personal/contratos/:id
   * Actualizar datos de un contrato
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const contrato = await contratosService.updateContrato(id, req.body);
      return successResponse(res, contrato, 'Contrato actualizado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * DELETE /api/personal/contratos/:id
   * Eliminar un contrato
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      await contratosService.deleteContrato(id);
      return successResponse(res, null, 'Contrato eliminado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * POST /api/personal/contratos/:id/renovar
   * Renovar un contrato (marca anterior como RENOVADO y crea uno nuevo)
   */
  renovar = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const userId = (req as any).user?.id || null;
      const contratoNuevo = await contratosService.renovarContrato(id, req.body, userId);
      return successResponse(res, contratoNuevo, 'Contrato renovado exitosamente', 201);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });
}

export const contratosController = new ContratosController();
