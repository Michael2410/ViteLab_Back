import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import {
  loginSchema,
  refreshTokenSchema,
  createUserSchema,
  updateUserSchema,
} from './auth.schema';
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
      return errorResponse(res, 'Error de validación', validation.error.errors, 400);
    }

    try {
      const result = await authService.login(validation.data);
      return successResponse(res, result, 'Login exitoso', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 401);
    }
  });

  /**
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const validation = refreshTokenSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.errors, 400);
    }

    try {
      const result = await authService.refreshToken(validation.data.refreshToken);
      return successResponse(res, result, 'Token renovado exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 401);
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
   * GET /api/auth/me
   */
  getMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return errorResponse(res, 'No autenticado', null, 401);
    }

    try {
      const user = await authService.getUserWithPermissions(userId);
      return successResponse(res, user, 'Usuario obtenido exitosamente', 200);
    } catch (error: any) {
      return errorResponse(res, error.message, null, 404);
    }
  });

  /**
   * POST /api/auth/users
   */
  createUser = asyncHandler(async (req: Request, res: Response) => {
    const validation = createUserSchema.safeParse(req.body);

    if (!validation.success) {
      return errorResponse(res, 'Error de validación', validation.error.errors, 400);
    }

    try {
      const user = await authService.createUser(validation.data);
      return successResponse(res, user, 'Usuario creado exitosamente', 201);
    } catch (error: any) {
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
      return errorResponse(res, 'Error de validación', validation.error.errors, 400);
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
}
