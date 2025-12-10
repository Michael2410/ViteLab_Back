import { Request, Response } from 'express';
import { rolesService } from './roles.service';
import { createRolSchema, updateRolSchema } from './roles.schema';
import { successResponse, errorResponse, asyncHandler } from '../../utils/response.utils';

export class RolesController {
  /**
   * GET /api/roles
   * Obtener todos los roles
   */
  getAll = asyncHandler(async (_req: Request, res: Response) => {
    try {
      const roles = await rolesService.getAll();
      return successResponse(res, roles, 'Roles obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/roles/active
   * Obtener roles activos (para selects)
   */
  getActive = asyncHandler(async (_req: Request, res: Response) => {
    try {
      const roles = await rolesService.getActive();
      return successResponse(res, roles, 'Roles activos obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/roles/:id
   * Obtener rol por ID
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const rol = await rolesService.getById(id);
      return successResponse(res, rol, 'Rol obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  });

  /**
   * POST /api/roles
   * Crear nuevo rol
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const validation = createRolSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const rol = await rolesService.create(validation.data);
      return successResponse(res, rol, 'Rol creado exitosamente', 201);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * PUT /api/roles/:id
   * Actualizar rol
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    const validation = updateRolSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const rol = await rolesService.update(id, validation.data as any);
      return successResponse(res, rol, 'Rol actualizado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * DELETE /api/roles/:id
   * Eliminar rol
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      await rolesService.delete(id);
      return successResponse(res, null, 'Rol eliminado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  // ============================================
  // PERMISOS
  // ============================================

  /**
   * GET /api/roles/permisos
   * Obtener todos los permisos
   */
  getAllPermisos = asyncHandler(async (_req: Request, res: Response) => {
    try {
      const permisos = await rolesService.getAllPermisos();
      return successResponse(res, permisos, 'Permisos obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/roles/permisos/agrupados
   * Obtener permisos agrupados por módulo
   */
  getPermisosAgrupados = asyncHandler(async (_req: Request, res: Response) => {
    try {
      const permisos = await rolesService.getPermisosAgrupados();
      return successResponse(res, permisos, 'Permisos agrupados obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/roles/:id/permisos
   * Obtener IDs de permisos de un rol
   */
  getPermisosByRol = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const permisos = await rolesService.getPermisosByRol(id);
      return successResponse(res, permisos, 'Permisos del rol obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });
}

export const rolesController = new RolesController();
