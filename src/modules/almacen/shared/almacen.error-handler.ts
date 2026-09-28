import type { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../../../utils/response.utils';
import { AlmacenError } from './almacen.errors';

const PG_A_HTTP: Record<string, [number, string]> = {
  '23505': [409, 'Ya existe un registro con esos datos'],
  '23503': [400, 'Hace referencia a un registro que no existe'],        // INSERT/UPDATE con FK inválida
  '23001': [409, 'El registro está relacionado con otros datos'],       // DELETE bloqueado por ON DELETE RESTRICT
  '23514': [422, 'Los datos no cumplen las reglas del almacén'],
  '22003': [400, 'Valor numérico fuera de rango'],
  '40P01': [409, 'Conflicto de concurrencia, intente nuevamente'],
};

const codigoPg = (err: unknown): string | undefined => {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.cause?.code ?? e?.code;   // DrizzleQueryError envuelve el error de pg en `cause`
};

export const almacenErrorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AlmacenError) {
    return errorResponse(res, err.message, err.code ? { code: err.code } : null, err.statusCode);
  }
  const pg = codigoPg(err);
  if (pg && PG_A_HTTP[pg]) {
    const [status, mensaje] = PG_A_HTTP[pg];
    return errorResponse(res, mensaje, null, status);
  }
  console.error('❌ [ALMACEN] Error no controlado:', err);   // solo en el servidor
  return errorResponse(res, 'Error interno del servidor', null, 500);
};
