import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { errorResponse } from '../../../utils/response.utils';

export const validar = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction): void => {
  const resultado = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!resultado.success) {
    errorResponse(
      res,
      'Errores de validación',
      resultado.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      400,
    );
    return;
  }
  res.locals.validated = resultado.data;
  next();
};

export const datosValidados = <T>(res: Response): T => res.locals.validated as T;
