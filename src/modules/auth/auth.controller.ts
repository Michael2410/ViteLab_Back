import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import {
  loginSchema,
  refreshTokenSchema,
  createUserSchema,
  updateUserSchema,
  verify2FASchema,
  confirm2FASetupSchema,
  selectTenantSchema,
  switchTenantSchema,
  changeInitialPasswordSchema,
  resetUserPasswordSchema,
} from './auth.schema';
import { masterDb, masterTenants } from '../../db/master';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse, asyncHandler } from '../../utils/response.utils';

const authService = new AuthService();

export class AuthController {
  /**
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    // Validar entrada
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Error de validación', 400);
    }

    try {
      const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']) : undefined;
      const result = await authService.login(validation.data, req.ip, userAgent);
      const message = (result as any).requires2FA ? 'Verificación 2FA requerida' : 'Login exitoso';
      return successResponse(res, result, message, 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 401);
    }
  });

  /**
   * POST /api/auth/2fa/verify
   */
  verify2FA = asyncHandler(async (req: Request, res: Response) => {
    const validation = verify2FASchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Código o token no válido', 400);
    }

    try {
      const result = await authService.verify2FA(validation.data.tempToken, validation.data.code);
      return successResponse(res, result, 'Autenticación exitosa', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 401);
    }
  });

  /**
   * POST /api/auth/2fa/confirm-setup
   */
  confirm2FASetup = asyncHandler(async (req: Request, res: Response) => {
    const validation = confirm2FASetupSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Código de 6 dígitos requerido', 400);
    }

    try {
      const result = await authService.confirm2FASetup(validation.data.tempToken, validation.data.code);
      return successResponse(res, result, 'Doble factor configurado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  });

  /**
   * POST /api/auth/2fa/admin-reset/:userId
   */
  adminReset2FA = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return errorResponse(res, 'ID de usuario inválido', 400);
    }

    try {
      await authService.adminReset2FA(userId);
      return successResponse(res, null, '2FA restablecido exitosamente para el usuario', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  /**
   * POST /api/auth/change-initial-password
   */
  changeInitialPassword = asyncHandler(async (req: Request, res: Response) => {
    const validation = changeInitialPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, validation.error.issues?.[0]?.message || 'Datos inválidos', 400);
    }

    try {
      const result = await authService.changeInitialPassword(
        validation.data.tempToken,
        validation.data.newPassword
      );
      return successResponse(res, result, 'Contraseña actualizada exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  });

  /**
   * POST /api/auth/users/:userId/reset-password
   */
  adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return errorResponse(res, 'ID de usuario inválido', 400);
    }

    const validation = resetUserPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return errorResponse(res, validation.error.issues?.[0]?.message || 'Datos inválidos', 400);
    }

    try {
      const result = await authService.adminResetPassword(userId, validation.data.newPassword);
      return successResponse(res, result, result.message, 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  });

  /**
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const validation = refreshTokenSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Error de validación', 400);
    }

    try {
      const result = await authService.refreshToken(validation.data.refreshToken);
      return successResponse(res, result, 'Token renovado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 401);
    }
  });

  /**
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return errorResponse(res, 'No autenticado', null, 401);
    }

    await authService.logout(userId);
    return successResponse(res, null, 'Logout exitoso', 200);
  });
  /**
   * POST /api/auth/select-tenant
   */
  selectTenant = asyncHandler(async (req: Request, res: Response) => {
    const validation = selectTenantSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Datos de selección inválidos', 400);
    }

    try {
      const result = await authService.selectTenant(validation.data.tempToken, validation.data.tenantId);
      return successResponse(res, result, 'Laboratorio seleccionado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 401);
    }
  });

  /**
   * POST /api/auth/switch-tenant
   */
  switchTenant = asyncHandler(async (req: Request, res: Response) => {
    const validation = switchTenantSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'ID de laboratorio inválido', 400);
    }

    const identityId = (req as any).user?.sub;
    const sessionId = (req as any).user?.sessionId;

    if (!identityId) {
      return errorResponse(res, 'Sesión no vinculada a identidad Master', 401);
    }

    try {
      const result = await authService.switchTenant(identityId, sessionId, validation.data.tenantId);
      return successResponse(res, result, 'Cambio de laboratorio exitoso', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  });

  /**
   * GET /api/auth/my-tenants
   */
  getMyTenants = asyncHandler(async (req: Request, res: Response) => {
    const identityId = (req as any).user?.sub;
    const currentTenantId = (req as any).user?.tenantId;

    if (!identityId) {
      return errorResponse(res, 'No autenticado', 401);
    }

    try {
      const tenants = await authService.getUserActiveTenants(identityId, currentTenantId);
      return successResponse(res, tenants, 'Laboratorios obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  });

  /**
   * GET /api/auth/me
   */
  getMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const tenantId = (req as any).user?.tenantId;

    if (!userId) {
      return errorResponse(res, 'No autenticado', null, 401);
    }

    try {
      const user = await authService.getUserWithPermissions(userId);
      let activeTenant: any = null;
      if (tenantId) {
        const [t] = await masterDb
          .select({
            id: masterTenants.id,
            slug: masterTenants.slug,
            name: masterTenants.name,
          })
          .from(masterTenants)
          .where(eq(masterTenants.id, tenantId));
        activeTenant = t || null;
      }
      return successResponse(res, { ...user, activeTenant }, 'Usuario obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  });

  /**
   * POST /api/auth/users
   */
  createUser = asyncHandler(async (req: Request, res: Response) => {
    console.log('📝 [CREATE USER] Body recibido:', req.body);
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      console.log('❌ [CREATE USER] Error de validación:', validation.error.issues);
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const user = await authService.createUser(validation.data);
      return successResponse(res, user, 'Usuario creado exitosamente', 201);
    } catch (error: any) {
      console.log('❌ [CREATE USER] Error:', error.message);
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * GET /api/auth/users
   */
  getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    try {
      const users = await authService.getAllUsers();
      return successResponse(res, users, 'Usuarios obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });

  /**
   * GET /api/auth/users/:id
   */
  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      const user = await authService.getUserById(id);
      return successResponse(res, user, 'Usuario obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  });

  /**
   * PUT /api/auth/users/:id
   */
  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    const validation = updateUserSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.issues, 400);
    }

    try {
      const user = await authService.updateUser(id, validation.data);
      return successResponse(res, user, 'Usuario actualizado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 400);
    }
  });

  /**
   * DELETE /api/auth/users/:id
   */
  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'ID inválido', null, 400);
    }

    try {
      await authService.deleteUser(id);
      return successResponse(res, null, 'Usuario eliminado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  });

  /**
   * GET /api/auth/roles
   */
  getAllRoles = asyncHandler(async (req: Request, res: Response) => {
    try {
      const roles = await authService.getAllRoles();
      return successResponse(res, roles, 'Roles obtenidos exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 500);
    }
  });
}
