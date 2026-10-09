import { Request, Response } from 'express';
import { personalService } from './personal.service';
import {
  createPersonalSchema,
  updatePersonalSchema,
  vincularCuentaSchema,
  darDeBajaSchema,
  updateCuentaSchema,
} from './personal.schema';
import { successResponse, errorResponse, asyncHandler } from '../../../utils/response.utils';

export class PersonalController {
  /**
   * GET /api/personal
   * Listar colaboradores con filtros opcionales
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { search, cargo, cargo_id, area, area_id, tipo_contrato_id, activo, sede_id, con_usuario } = req.query;

      const parseMultiString = (val: any): string[] | undefined => {
        if (!val) return undefined;
        if (Array.isArray(val)) {
          const arr = val.map(String).map((s) => s.trim()).filter(Boolean);
          return arr.length > 0 ? arr : undefined;
        }
        const arr = String(val).split(',').map((s) => s.trim()).filter(Boolean);
        return arr.length > 0 ? arr : undefined;
      };

      const filtros = {
        search: search ? String(search) : undefined,
        cargo: parseMultiString(cargo),
        cargo_id: cargo_id ? parseInt(String(cargo_id)) : undefined,
        area: parseMultiString(area),
        area_id: area_id ? parseInt(String(area_id)) : undefined,
        tipo_contrato_id: tipo_contrato_id ? parseInt(String(tipo_contrato_id)) : undefined,
        activo: activo !== undefined ? activo === 'true' : undefined,
        sede_id: sede_id ? parseInt(String(sede_id)) : undefined,
        con_usuario: con_usuario !== undefined ? con_usuario === 'true' : undefined,
      };

      const personal = await personalService.getAllPersonal(filtros);
      return successResponse(res, personal, 'Personal obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/personal/:id
   * Obtener detalle de colaborador por ID
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const colaborador = await personalService.getPersonalById(id);
      return successResponse(res, colaborador, 'Colaborador obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  });

  /**
   * POST /api/personal
   * Registrar nuevo colaborador
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const validation = createPersonalSchema.safeParse(req.body);
    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const userId = (req as any).user?.id || null;
      const colaborador = await personalService.createPersonal(validation.data, userId);
      return successResponse(res, colaborador, 'Colaborador registrado exitosamente', 201);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * PUT /api/personal/:id
   * Actualizar datos del colaborador
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    const validation = updatePersonalSchema.safeParse(req.body);
    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const colaborador = await personalService.updatePersonal(id, validation.data);
      return successResponse(res, colaborador, 'Colaborador actualizado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * DELETE /api/personal/:id
   * Desactivar colaborador
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      await personalService.deletePersonal(id);
      return successResponse(res, null, 'Colaborador desactivado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * POST /api/personal/:id/dar-de-baja
   * Dar de baja al colaborador (cese laboral)
   */
  darDeBaja = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    const validation = darDeBajaSchema.safeParse(req.body);
    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const userId = (req as any).user?.id || null;
      const colaborador = await personalService.darDeBaja(id, validation.data, userId);
      return successResponse(res, colaborador, 'Colaborador dado de baja exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * POST /api/personal/:id/reincorporar
   * Reincorporar al colaborador cesado
   */
  reincorporar = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const userId = (req as any).user?.id || null;
      const colaborador = await personalService.reincorporar(id, userId);
      return successResponse(res, colaborador, 'Colaborador reincorporado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * POST /api/personal/:id/cuenta
   * Crear y vincular una cuenta de usuario de sistema a un personal existente
   */
  vincularCuenta = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    const validation = vincularCuentaSchema.safeParse(req.body);
    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const cuenta = await personalService.vincularCuenta(id, validation.data);
      return successResponse(res, cuenta, 'Cuenta vinculada exitosamente', 201);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * PUT /api/personal/:id/cuenta
   * Modificar estado, rol o credenciales de la cuenta vinculada
   */
  updateCuenta = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    const validation = updateCuentaSchema.safeParse(req.body);
    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const cuenta = await personalService.updateCuenta(id, validation.data);
      return successResponse(res, cuenta, 'Cuenta actualizada exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * DELETE /api/personal/:id/cuenta
   * Desvincular / suspender cuenta de sistema del colaborador
   */
  desvincularCuenta = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      await personalService.desvincularCuenta(id);
      return successResponse(res, null, 'Cuenta desvinculada exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });
}

export const personalController = new PersonalController();
