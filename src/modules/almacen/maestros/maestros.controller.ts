import type { Request, Response } from 'express';
import { asyncHandler, successResponse } from '../../../utils/response.utils';
import { datosValidados } from '../shared/almacen.validate';
import { contexto, sedesVisibles } from '../shared/almacen.contexto';
import { almacenMaestrosService } from './maestros.service';
import type {
  UnidadMedidaInput,
  CategoriaInput,
  AlmacenInput,
  UbicacionInput,
  ListarAlmacenesQuery,
  ListarUbicacionesQuery,
} from './maestros.schema';

type ConId = { params: { id: number } };

export class AlmacenMaestrosController {
  // UNIDADES
  listarUnidades = asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(
      res,
      await almacenMaestrosService.listarUnidades(),
      'Unidades de medida obtenidas exitosamente'
    );
  });

  crearUnidad = asyncHandler(async (_req: Request, res: Response) => {
    const { body } = datosValidados<{ body: UnidadMedidaInput }>(res);
    return successResponse(
      res,
      await almacenMaestrosService.crearUnidad(body),
      'Unidad de medida creada exitosamente',
      201
    );
  });

  actualizarUnidad = asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: Partial<UnidadMedidaInput> }>(res);
    return successResponse(
      res,
      await almacenMaestrosService.actualizarUnidad(params.id, body),
      'Unidad de medida actualizada exitosamente'
    );
  });

  desactivarUnidad = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await almacenMaestrosService.desactivarUnidad(params.id),
      'Unidad de medida desactivada exitosamente'
    );
  });

  // CATEGORIAS
  listarCategorias = asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(
      res,
      await almacenMaestrosService.listarCategorias(),
      'Categorías obtenidas exitosamente'
    );
  });

  crearCategoria = asyncHandler(async (_req: Request, res: Response) => {
    const { body } = datosValidados<{ body: CategoriaInput }>(res);
    return successResponse(
      res,
      await almacenMaestrosService.crearCategoria(body),
      'Categoría creada exitosamente',
      201
    );
  });

  actualizarCategoria = asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: Partial<CategoriaInput> }>(res);
    return successResponse(
      res,
      await almacenMaestrosService.actualizarCategoria(params.id, body),
      'Categoría actualizada exitosamente'
    );
  });

  desactivarCategoria = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await almacenMaestrosService.desactivarCategoria(params.id),
      'Categoría desactivada exitosamente'
    );
  });

  // ALMACENES
  listarAlmacenes = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarAlmacenesQuery }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenMaestrosService.listarAlmacenes(sedes, query.sede_id, query.activo),
      'Almacenes obtenidos exitosamente'
    );
  });

  obtenerAlmacen = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await almacenMaestrosService.obtenerAlmacen(params.id),
      'Almacén obtenido exitosamente'
    );
  });

  crearAlmacen = asyncHandler(async (_req: Request, res: Response) => {
    const { body } = datosValidados<{ body: AlmacenInput }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenMaestrosService.crearAlmacen(body, sedes),
      'Almacén creado exitosamente',
      201
    );
  });

  actualizarAlmacen = asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: Partial<AlmacenInput> }>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenMaestrosService.actualizarAlmacen(params.id, body, sedes),
      'Almacén actualizado exitosamente'
    );
  });

  desactivarAlmacen = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    const ctx = contexto(res);
    const sedes = sedesVisibles(ctx);
    return successResponse(
      res,
      await almacenMaestrosService.desactivarAlmacen(params.id, sedes),
      'Almacén desactivado exitosamente'
    );
  });

  // UBICACIONES
  listarUbicaciones = asyncHandler(async (_req: Request, res: Response) => {
    const { query } = datosValidados<{ query: ListarUbicacionesQuery }>(res);
    return successResponse(
      res,
      await almacenMaestrosService.listarUbicaciones(query.almacen_id, query.activo),
      'Ubicaciones obtenidas exitosamente'
    );
  });

  crearUbicacion = asyncHandler(async (_req: Request, res: Response) => {
    const { body } = datosValidados<{ body: UbicacionInput }>(res);
    return successResponse(
      res,
      await almacenMaestrosService.crearUbicacion(body),
      'Ubicación creada exitosamente',
      201
    );
  });

  actualizarUbicacion = asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = datosValidados<ConId & { body: Partial<UbicacionInput> }>(res);
    return successResponse(
      res,
      await almacenMaestrosService.actualizarUbicacion(params.id, body),
      'Ubicación actualizada exitosamente'
    );
  });

  desactivarUbicacion = asyncHandler(async (_req: Request, res: Response) => {
    const { params } = datosValidados<ConId>(res);
    return successResponse(
      res,
      await almacenMaestrosService.desactivarUbicacion(params.id),
      'Ubicación desactivada exitosamente'
    );
  });
}

export const almacenMaestrosController = new AlmacenMaestrosController();
