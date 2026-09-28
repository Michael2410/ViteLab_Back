import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles } from '../shared/almacen.contexto';
import { ajustesService } from './ajustes.service';
import type {
  CrearAjusteInput,
  RechazarAjusteInput,
  ListarAjustesQuery,
} from './ajustes.schema';

type ConId = { params: { id: number } };

export class AlmacenAjustesController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarAjustesQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await ajustesService.listar(query, sedes),
      'Ajustes obtenidos exitosamente'
    );
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await ajustesService.obtener(params.id),
      'Ajuste obtenido exitosamente'
    );
  });

  crear = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearAjusteInput }>(res);
    const resultado = await ajustesService.crear(body, req.user!.userId);
    return successResponse(res, resultado, 'Ajuste registrado exitosamente', 201);
  });

  aprobar = asyncHandler(async (req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    const esSuperAdmin = req.user?.rolId === 1; // Rol SUPER_ADMIN
    const resultado = await ajustesService.aprobar(params.id, req.user!.userId, esSuperAdmin);
    return successResponse(res, resultado, 'Ajuste aprobado exitosamente');
  });

  rechazar = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: RechazarAjusteInput }>(res);
    const resultado = await ajustesService.rechazar(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Ajuste rechazado exitosamente');
  });
}

export const ajustesController = new AlmacenAjustesController();
