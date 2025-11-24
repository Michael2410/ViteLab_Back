import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../modules/auth/auth.types';
import { errorResponse } from '../utils/response.utils';
import pool from '../config/database';

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
    const userQuery = await pool.query(
      'SELECT id FROM usuarios WHERE id = $1 AND activo = true',
      [decoded.userId]
    );

    if (userQuery.rows.length === 0) {
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
 */
export const requirePermissions = (requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      if (!req.user) {
        return errorResponse(res, 'No autenticado', null, 401);
      }

      // Obtener permisos del usuario
      const permissionsQuery = `
        SELECT p.codigo
        FROM roles_permisos rp
        INNER JOIN permisos p ON rp.permiso_id = p.id
        WHERE rp.rol_id = $1
      `;

      const result = await pool.query(permissionsQuery, [req.user.rolId]);
      const userPermissions = result.rows.map((row: any) => row.codigo);

      // Verificar si tiene todos los permisos requeridos
      const hasPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission)
      );

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
    const roleQuery = await pool.query(
      'SELECT r.nombre FROM usuarios u INNER JOIN roles r ON u.rol_id = r.id WHERE u.id = $1',
      [req.user.userId]
    );

    if (roleQuery.rows.length === 0) {
      return errorResponse(res, 'Usuario no encontrado', null, 404);
    }

    const roleName = roleQuery.rows[0].nombre;

    if (roleName !== 'SUPER_ADMIN' && roleName !== 'ADMIN') {
      return errorResponse(res, 'Acceso denegado. Se requiere rol de administrador', null, 403);
    }

    next();
  } catch (error) {
    return errorResponse(res, 'Error al verificar rol', null, 500);
  }
};
