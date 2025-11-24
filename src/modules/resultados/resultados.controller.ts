import { Request, Response } from 'express';
import { resultadosService } from './resultados.service';
import { successResponse, errorResponse } from '../../utils/response.utils';
import type { CreateResultadoInput, UpdateResultadoInput, BulkResultadosInput } from './resultados.types';

class ResultadosController {
  // ============================================
  // CREAR RESULTADO INDIVIDUAL
  // ============================================

  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateResultadoInput = req.body;
      const usuarioId = req.user?.userId;

      if (!usuarioId) {
        errorResponse(res, 'Usuario no autenticado', 401);
        return;
      }

      const resultado = await resultadosService.createResultado(data, usuarioId);

      successResponse(res, resultado, 'Resultado creado exitosamente', 201);
    } catch (error: any) {
      errorResponse(res, error.message || 'Error al crear resultado', 500);
    }
  }

  // ============================================
  // CREAR MÚLTIPLES RESULTADOS (BULK)
  // ============================================

  async createBulk(req: Request, res: Response): Promise<void> {
    try {
      const data: BulkResultadosInput = req.body;
      const usuarioId = req.user?.userId;

      if (!usuarioId) {
        errorResponse(res, 'Usuario no autenticado', 401);
        return;
      }

      const result = await resultadosService.createBulkResultados(data, usuarioId);

      successResponse(
        res,
        result,
        `${result.created} resultados creados exitosamente. Orden actualizada a CON_RESULTADOS.`,
        201
      );
    } catch (error: any) {
      errorResponse(res, error.message || 'Error al crear resultados', 500);
    }
  }

  // ============================================
  // OBTENER RESULTADO POR ID
  // ============================================

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        errorResponse(res, 'ID inválido', 400);
        return;
      }

      const resultado = await resultadosService.getResultadoById(id);

      successResponse(res, resultado, 'Resultado obtenido exitosamente');
    } catch (error: any) {
      if (error.message === 'Resultado no encontrado') {
        errorResponse(res, error.message, 404);
      } else {
        errorResponse(res, error.message || 'Error al obtener resultado', 500);
      }
    }
  }

  // ============================================
  // OBTENER RESULTADOS CON FILTROS
  // ============================================

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        orden_id: req.query.orden_id ? parseInt(req.query.orden_id as string, 10) : undefined,
        orden_analisis_id: req.query.orden_analisis_id
          ? parseInt(req.query.orden_analisis_id as string, 10)
          : undefined,
        componente_id: req.query.componente_id
          ? parseInt(req.query.componente_id as string, 10)
          : undefined,
      };

      const resultados = await resultadosService.getResultados(filters);

      successResponse(res, resultados, 'Resultados obtenidos exitosamente');
    } catch (error: any) {
      errorResponse(res, error.message || 'Error al obtener resultados', 500);
    }
  }

  // ============================================
  // OBTENER ORDEN CON TODOS SUS RESULTADOS
  // ============================================

  async getByOrden(req: Request, res: Response): Promise<void> {
    try {
      const ordenId = parseInt(req.params.ordenId, 10);

      if (isNaN(ordenId)) {
        errorResponse(res, 'ID de orden inválido', 400);
        return;
      }

      const ordenConResultados = await resultadosService.getOrdenConResultados(ordenId);

      successResponse(res, ordenConResultados, 'Orden con resultados obtenida exitosamente');
    } catch (error: any) {
      if (error.message === 'Orden no encontrada') {
        errorResponse(res, error.message, 404);
      } else {
        errorResponse(res, error.message || 'Error al obtener orden con resultados', 500);
      }
    }
  }

  // ============================================
  // ACTUALIZAR RESULTADO
  // ============================================

  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        errorResponse(res, 'ID inválido', 400);
        return;
      }

      const data: UpdateResultadoInput = req.body;

      const resultado = await resultadosService.updateResultado(id, data);

      successResponse(res, resultado, 'Resultado actualizado exitosamente');
    } catch (error: any) {
      if (error.message === 'Resultado no encontrado') {
        errorResponse(res, error.message, 404);
      } else {
        errorResponse(res, error.message || 'Error al actualizar resultado', 500);
      }
    }
  }

  // ============================================
  // ELIMINAR RESULTADO
  // ============================================

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        errorResponse(res, 'ID inválido', 400);
        return;
      }

      await resultadosService.deleteResultado(id);

      successResponse(res, null, 'Resultado eliminado exitosamente');
    } catch (error: any) {
      if (error.message === 'Resultado no encontrado') {
        errorResponse(res, error.message, 404);
      } else {
        errorResponse(res, error.message || 'Error al eliminar resultado', 500);
      }
    }
  }
}

export const resultadosController = new ResultadosController();
