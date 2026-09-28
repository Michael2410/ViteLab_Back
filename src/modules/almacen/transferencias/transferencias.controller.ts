import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles } from '../shared/almacen.contexto';
import { transferenciasService } from './transferencias.service';
import type {
  CrearTransferenciaInput,
  RecibirTransferenciaInput,
  AnularTransferenciaInput,
  ListarTransferenciasQuery,
} from './transferencias.schema';

type ConId = { params: { id: number } };

export class AlmacenTransferenciasController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarTransferenciasQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await transferenciasService.listar(query, sedes),
      'Transferencias obtenidas exitosamente'
    );
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await transferenciasService.obtener(params.id),
      'Transferencia obtenida exitosamente'
    );
  });

  crear = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearTransferenciaInput }>(res);
    const resultado = await transferenciasService.crear(body, req.user!.userId);
    return successResponse(res, resultado, 'Transferencia enviada exitosamente', 201);
  });

  recibir = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: RecibirTransferenciaInput }>(res);
    const resultado = await transferenciasService.recibir(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Transferencia recepcionada exitosamente');
  });

  anular = asyncHandler(async (req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: AnularTransferenciaInput }>(res);
    const resultado = await transferenciasService.anular(params.id, body, req.user!.userId);
    return successResponse(res, resultado, 'Transferencia anulada exitosamente');
  });
}

export const transferenciasController = new AlmacenTransferenciasController();
