import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles } from '../shared/almacen.contexto';
import { despachosService } from './despachos.service';
import type {
  CrearDespachoInput,
  AnularDespachoInput,
  ListarDespachosQuery,
} from './despachos.schema';

type ConId = { params: { id: number } };

export class AlmacenDespachosController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarDespachosQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await despachosService.listar(query, sedes),
      'Despachos obtenidos exitosamente'
    );
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await despachosService.obtener(params.id, sedes),
      'Despacho obtenido exitosamente'
    );
  });

  crear = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearDespachoInput }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const resultado = await despachosService.crear(body, req.user!.userId, sedes);
    return successResponse(res, resultado, 'Despacho registrado exitosamente', 201);
  });

  anular = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AnularDespachoInput }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const resultado = await despachosService.anular(params.id, body, req.user!.userId, sedes);
    return successResponse(res, resultado, 'Despacho anulado exitosamente');
  });
}

export const despachosController = new AlmacenDespachosController();
