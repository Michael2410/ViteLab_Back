import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles } from '../shared/almacen.contexto';
import { AlmacenOrdenesCompraService } from './ordenes-compra.service';
import type {
  CrearOrdenCompraInput,
  AnularOrdenCompraInput,
  ListarOrdenesCompraQuery,
} from './ordenes-compra.schema';

type ConId = { params: { id: number } };

const service = new AlmacenOrdenesCompraService();

export class AlmacenOrdenesCompraController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarOrdenesCompraQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const resultado = await service.listar(query, sedes);
    return successResponse(res, resultado, 'Órdenes de compra obtenidas exitosamente');
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const resultado = await service.obtenerPorId(params.id, sedes);
    return successResponse(res, resultado, 'Orden de compra obtenida exitosamente');
  });

  crear = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearOrdenCompraInput }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const sedeDefectoId = ctx.sedeIds[0] || (req.user as any)?.sedeId || 1;
    const resultado = await service.crear(body, req.user!.userId, sedeDefectoId, sedes);
    return successResponse(res, resultado, 'Orden de compra creada exitosamente', 201);
  });

  anular = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AnularOrdenCompraInput }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    await service.anular(params.id, req.user!.userId, body, sedes);
    return successResponse(res, null, 'Orden de compra anulada exitosamente');
  });
}

export const almacenOrdenesCompraController = new AlmacenOrdenesCompraController();
