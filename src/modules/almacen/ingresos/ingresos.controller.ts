import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles } from '../shared/almacen.contexto';
import { almacenIngresosService } from './ingresos.service';
import type {
  CrearIngresoInput,
  AnularIngresoInput,
  ListarIngresosQuery,
} from './ingresos.schema';

type ConId = { params: { id: number } };

export class AlmacenIngresosController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarIngresosQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenIngresosService.listar(query, sedes),
      'Ingresos obtenidos exitosamente'
    );
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenIngresosService.obtener(params.id, sedes),
      'Ingreso obtenido exitosamente'
    );
  });

  crear = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearIngresoInput }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const resultado = await almacenIngresosService.crear(body, req.user!.userId, sedes);
    return successResponse(res, resultado, 'Ingreso registrado exitosamente', 201);
  });

  anular = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AnularIngresoInput }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const resultado = await almacenIngresosService.anular(params.id, body, req.user!.userId, sedes);
    return successResponse(res, resultado, 'Ingreso anulado exitosamente');
  });
}

export const almacenIngresosController = new AlmacenIngresosController();
