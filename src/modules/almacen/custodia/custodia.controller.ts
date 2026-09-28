import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles, tienePermiso } from '../shared/almacen.contexto';
import { custodiaService } from './custodia.service';
import type { ListarCustodiaQuery } from './custodia.schema';

export class AlmacenCustodiaController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarCustodiaQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const puedeVerTodo = tienePermiso(ctx, 'almacen.custodia.read_personal');

    const resultado = await custodiaService.listar(
      query,
      ctx.userId,
      puedeVerTodo,
      sedes
    );

    return successResponse(res, resultado, 'Inventario en custodia obtenido exitosamente');
  });

  resumen = asyncHandler(async (req: Request, res: Response) => {
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    const puedeVerTodo = tienePermiso(ctx, 'almacen.custodia.read_personal');
    const personalIdParam = req.query.personal_id ? Number(req.query.personal_id) : undefined;

    const resumen = await custodiaService.obtenerResumen(
      ctx.userId,
      puedeVerTodo,
      personalIdParam,
      sedes
    );

    return successResponse(res, resumen, 'Resumen de custodia obtenido exitosamente');
  });
}

export const custodiaController = new AlmacenCustodiaController();
