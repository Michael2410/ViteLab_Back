import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { almacenProveedoresService } from './proveedores.service';
import type {
  ListarProveedoresQuery,
  CrearProveedorInput,
  ActualizarProveedorInput,
} from './proveedores.schema';

type ConId = { params: { id: number } };

export class AlmacenProveedoresController {
  listar = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarProveedoresQuery }>(res);
    return successResponse(
      res,
      await almacenProveedoresService.listar(query),
      'Proveedores obtenidos exitosamente'
    );
  });

  obtener = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await almacenProveedoresService.obtener(params.id),
      'Proveedor obtenido exitosamente'
    );
  });

  crear = asyncHandler(async (_req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CrearProveedorInput }>(res);
    const prov = await almacenProveedoresService.crear(body);
    return successResponse(res, prov, 'Proveedor creado exitosamente', 201);
  });

  actualizar = asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: ActualizarProveedorInput }>(res);
    return successResponse(
      res,
      await almacenProveedoresService.actualizar(params.id, body),
      'Proveedor actualizado exitosamente'
    );
  });

  desactivar = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await almacenProveedoresService.desactivar(params.id),
      'Proveedor desactivado exitosamente'
    );
  });
}

export const almacenProveedoresController = new AlmacenProveedoresController();
