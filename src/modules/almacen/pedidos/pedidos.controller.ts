import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles, tienePermiso } from '../shared/almacen.contexto';
import { pedidosService } from './pedidos.service';
import type {
  CrearPedidoInput,
  AprobarPedidoInput,
  RechazarPedidoInput,
  AnularPedidoInput,
  ListarPedidosQuery,
} from './pedidos.schema';

type ConId = { params: { id: number } };

export class AlmacenPedidosController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarPedidosQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const puedeAprobar = tienePermiso(ctx, 'almacen.pedidos.approve');

    return successResponse(
      res,
      await pedidosService.listar(query, ctx.userId, puedeAprobar, sedes),
      'Pedidos obtenidos exitosamente'
    );
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await pedidosService.obtener(params.id),
      'Pedido obtenido exitosamente'
    );
  });

  crear = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearPedidoInput }>(res);
    const resultado = await pedidosService.crear(body, req.user!.userId);
    return successResponse(res, resultado, 'Pedido registrado exitosamente', 201);
  });

  aprobar = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AprobarPedidoInput }>(res);
    const resultado = await pedidosService.aprobar(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Pedido aprobado exitosamente');
  });

  rechazar = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: RechazarPedidoInput }>(res);
    const resultado = await pedidosService.rechazar(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Pedido rechazado exitosamente');
  });

  anular = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AnularPedidoInput }>(res);
    const resultado = await pedidosService.anular(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Pedido anulado exitosamente');
  });
}

export const pedidosController = new AlmacenPedidosController();
