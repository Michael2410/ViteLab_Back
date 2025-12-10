import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('🔍 [VALIDATE] Body recibido:', JSON.stringify(req.body, null, 2));
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        console.log('❌ [VALIDATE] Errores Zod:', JSON.stringify(error.issues, null, 2));
        res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: error.issues.map((err: any) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
};
