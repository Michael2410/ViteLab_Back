import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../modules/auth/auth.types';
import { errorResponse } from '../utils/response.utils';
import { db, usuarios, roles, rolesPermisos, permisos } from '../db';
import { eq, and } from 'drizzle-orm';

// Extender Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware para verificar JWT Access Token
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  return authenticateToken(req, res, next);
};

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return errorResponse(res, 'Token no proporcionado', null, 401);
    }

    // Verificar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || 'access_secret'
    ) as JwtPayload;

    // Verificar que el usuario existe y está activo
    const [user] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(eq(usuarios.id, decoded.userId), eq(usuarios.activo, true)));

    if (!user) {
      return errorResponse(res, 'Usuario no autorizado', null, 401);
    }

    // Agregar user al request
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expirado', null, 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Token inválido', null, 401);
    }
    return errorResponse(res, 'Error de autenticación', null, 401);
  }
};

/**
 * Middleware para verificar permisos específicos
 * @param requiredPermissions Array de códigos de permisos requeridos
 * @param requireAll Si es true, requiere TODOS los permisos. Si es false, requiere AL MENOS UNO
 */
export const requirePermissions = (requiredPermissions: string[], requireAll: boolean = true) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      if (!req.user) {
        return errorResponse(res, 'No autenticado', null, 401);
      }

      // Obtener permisos del usuario
      const result = await db
        .select({ codigo: permisos.codigo })
        .from(rolesPermisos)
        .innerJoin(permisos, eq(rolesPermisos.permiso_id, permisos.id))
        .where(eq(rolesPermisos.rol_id, req.user.rolId));
      const userPermissions = result.map((row) => row.codigo);

      // Verificar permisos
      let hasPermissions: boolean;
      if (requireAll) {
        // Requiere TODOS los permisos
        hasPermissions = requiredPermissions.every((permission) =>
          userPermissions.includes(permission)
        );
      } else {
        // Requiere AL MENOS UNO de los permisos
        hasPermissions = requiredPermissions.some((permission) =>
          userPermissions.includes(permission)
        );
      }

      if (!hasPermissions) {
        return errorResponse(res, 'No tienes permisos para realizar esta acción', null, 403);
      }

      next();
    } catch (error) {
      return errorResponse(res, 'Error al verificar permisos', null, 500);
    }
  };
};

/**
 * Middleware para verificar un solo permiso
 * @param permission Código del permiso requerido
 */
export const requirePermission = (permission: string) => {
  return requirePermissions([permission], true);
};

/**
 * Middleware para verificar si es SUPER_ADMIN o ADMIN
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    if (!req.user) {
      return errorResponse(res, 'No autenticado', null, 401);
    }

    // Obtener rol del usuario
    const [roleRow] = await db
      .select({ nombre: roles.nombre })
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rol_id, roles.id))
      .where(eq(usuarios.id, req.user.userId));

    if (!roleRow) {
      return errorResponse(res, 'Usuario no encontrado', null, 404);
    }

    const roleName = roleRow.nombre;

    if (roleName !== 'SUPER_ADMIN' && roleName !== 'ADMIN') {
      return errorResponse(res, 'Acceso denegado. Se requiere rol de administrador', null, 403);
    }

    next();
  } catch (error) {
    return errorResponse(res, 'Error al verificar rol', null, 500);
  }
};
