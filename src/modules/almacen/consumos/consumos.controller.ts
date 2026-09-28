import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles, tienePermiso } from '../shared/almacen.contexto';
import { consumosService } from './consumos.service';
import type {
  CrearConsumoInput,
  AnularConsumoInput,
  ListarConsumosQuery,
  CrearDevolucionInput,
  AnularDevolucionInput,
  ListarDevolucionesQuery,
} from './consumos.schema';

type ConId = { params: { id: number } };

export class AlmacenConsumosController {
  // Consumos
  listarConsumos = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarConsumosQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const puedeVerTodo = tienePermiso(ctx, 'almacen.custodia.read_personal');

    return successResponse(
      res,
      await consumosService.listarConsumos(query, ctx.userId, puedeVerTodo, sedes),
      'Consumos obtenidos exitosamente'
    );
  });

  obtenerConsumo = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await consumosService.obtenerConsumo(params.id),
      'Consumo obtenido exitosamente'
    );
  });

  crearConsumo = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearConsumoInput }>(res);
    const resultado = await consumosService.crearConsumo(body, req.user!.userId);
    return successResponse(res, resultado, 'Consumo registrado exitosamente', 201);
  });

  anularConsumo = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AnularConsumoInput }>(res);
    const resultado = await consumosService.anularConsumo(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Consumo anulado exitosamente');
  });

  // Devoluciones
  listarDevoluciones = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarDevolucionesQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const puedeVerTodo = tienePermiso(ctx, 'almacen.custodia.read_personal');

    return successResponse(
      res,
      await consumosService.listarDevoluciones(query, ctx.userId, puedeVerTodo, sedes),
      'Devoluciones obtenidas exitosamente'
    );
  });

  obtenerDevolucion = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await consumosService.obtenerDevolucion(params.id),
      'Devolución obtenida exitosamente'
    );
  });

  crearDevolucion = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearDevolucionInput }>(res);
    const resultado = await consumosService.crearDevolucion(body, req.user!.userId);
    return successResponse(res, resultado, 'Devolución registrada exitosamente', 201);
  });

  anularDevolucion = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AnularDevolucionInput }>(res);
    const resultado = await consumosService.anularDevolucion(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Devolución anulada exitosamente');
  });
}

export const consumosController = new AlmacenConsumosController();
