import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { almacenProductosService } from './productos.service';
import type { ListarProductosQuery, CrearProductoInput, ActualizarProductoInput } from './productos.schema';

type ConId = { params: { id: number } };

export class AlmacenProductosController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarProductosQuery }>(res);
    return successResponse(res, await almacenProductosService.listar(query), 'Productos obtenidos exitosamente');
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(res, await almacenProductosService.obtener(params.id), 'Producto obtenido exitosamente');
  });

  crear = asyncHandler(async (req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearProductoInput }>(res);
    const producto = await almacenProductosService.crear(body, req.user!.userId);
    return successResponse(res, producto, 'Producto creado exitosamente', 201);
  });

  actualizar = asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: ActualizarProductoInput }>(res);
    return successResponse(res, await almacenProductosService.actualizar(params.id, body), 'Producto actualizado exitosamente');
  });

  desactivar = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(res, await almacenProductosService.desactivar(params.id), 'Producto desactivado exitosamente');
  });
}

export const almacenProductosController = new AlmacenProductosController();
