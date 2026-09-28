import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles } from '../shared/almacen.contexto';
import { almacenStockService } from './stock.service';
import type { ListarStockQuery, ListarKardexQuery } from './stock.schema';

export class AlmacenStockController {
  listarStock = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarStockQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenStockService.listarStock(query, sedes),
      'Stock obtenido exitosamente'
    );
  });

  listarKardex = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarKardexQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenStockService.listarKardex(query, sedes),
      'Movimientos de kardex obtenidos exitosamente'
    );
  });
}

export const almacenStockController = new AlmacenStockController();
