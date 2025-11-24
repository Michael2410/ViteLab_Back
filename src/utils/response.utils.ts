import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/api.types';

// Función helper para respuestas exitosas
export const successResponse = <T>(
  res: Response,
  data: T,
  message: string = 'OK',
  statusCode: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(response);
};

// Función helper para respuestas de error
export const errorResponse = (
  res: Response,
  message: string,
  errors: any = null,
  statusCode: number = 400
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    errors,
  };
  return res.status(statusCode).json(response);
};

// Middleware global para manejo de errores
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  console.error('❌ Error:', err);

  // Error de Zod
  if (err.name === 'ZodError') {
    return errorResponse(res, 'Error de validación', err.errors, 400);
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Token inválido', null, 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expirado', null, 401);
  }

  // Error genérico
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  return errorResponse(res, message, null, statusCode);
};

// Wrapper para async handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
