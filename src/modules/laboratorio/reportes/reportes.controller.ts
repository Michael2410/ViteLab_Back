import { Request, Response } from 'express';
import { reportesService } from './reportes.service';
import { db, usuariosSedes } from '../../../db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '../../../utils/response.utils';
import type { FiltrosReporte, FiltrosCuadreCaja } from './reportes.types';

class ReportesController {
  /**
   * Obtener sedes del usuario para filtros
   */
  private async getSedesUsuario(usuarioId?: number, rolId?: number): Promise<number[] | undefined> {
    if (!usuarioId) return undefined;
    
    // Si el usuario es Administrador (rol_id = 1), tiene acceso a todas las sedes
    if (rolId === 1) {
      return undefined;
    }
    
    const result = await db
      .select({ sedeId: usuariosSedes.sede_id })
      .from(usuariosSedes)
      .where(eq(usuariosSedes.usuario_id, usuarioId));
    
    return result.length > 0 
      ? result.map((r) => r.sedeId) 
      : undefined;
  }

  /**
   * Reporte de Órdenes por Período
   * GET /api/reportes/ordenes-periodo
   */
  async getOrdenesPorPeriodo(req: Request, res: Response): Promise<void> {
    try {
      const sedeIdQuery = req.query.sede_id ? parseInt(req.query.sede_id as string) : undefined;
      const sedesUsuario = sedeIdQuery ? undefined : await this.getSedesUsuario(req.user?.userId, req.user?.rolId);
      
      const filtros: FiltrosReporte = {
        fecha_inicio: req.query.fecha_inicio as string,
        fecha_fin: req.query.fecha_fin as string,
        sede_id: sedeIdQuery,
        sede_ids: sedesUsuario,
        estado: req.query.estado as string,
        metodo_pago: req.query.metodo_pago as string,
        usuario_registro_id: req.query.usuario_registro_id ? parseInt(req.query.usuario_registro_id as string) : (req.query.usuario_id ? parseInt(req.query.usuario_id as string) : undefined),
      };

      const reporte = await reportesService.getOrdenesPorPeriodo(filtros);
      successResponse(res, reporte, 'Reporte de órdenes generado exitosamente');
    } catch (error) {
      console.error('Error en reporte órdenes por período:', error);
      errorResponse(res, 'Error al generar reporte', null, 500);
    }
  }

  /**
   * Reporte de Cuadre de Caja Diaria
   * GET /api/reportes/cuadre-caja
   */
  async getCuadreCaja(req: Request, res: Response): Promise<void> {
    try {
      const sedeIdQuery = req.query.sede_id ? parseInt(req.query.sede_id as string) : undefined;
      const sedesUsuario = sedeIdQuery ? undefined : await this.getSedesUsuario(req.user?.userId, req.user?.rolId);

      const filtros: FiltrosCuadreCaja = {
        fecha: req.query.fecha as string,
        sede_id: sedeIdQuery,
        sede_ids: sedesUsuario,
        usuario_id: req.query.usuario_id ? parseInt(req.query.usuario_id as string) : undefined,
      };

      const reporte = await reportesService.getCuadreCaja(filtros);
      successResponse(res, reporte, 'Cuadre de caja generado exitosamente');
    } catch (error) {
      console.error('Error en reporte cuadre de caja:', error);
      errorResponse(res, 'Error al generar reporte de cuadre de caja', null, 500);
    }
  }

  /**
   * Reporte de Ingresos por Sede
   * GET /api/reportes/ingresos-sede
   */
  async getIngresosPorSede(req: Request, res: Response): Promise<void> {
    try {
      const sedesUsuario = await this.getSedesUsuario(req.user?.userId, req.user?.rolId);
      
      const filtros: FiltrosReporte = {
        fecha_inicio: req.query.fecha_inicio as string,
        fecha_fin: req.query.fecha_fin as string,
        sede_ids: sedesUsuario,
      };

      const reporte = await reportesService.getIngresosPorSede(filtros);
      successResponse(res, reporte, 'Reporte de ingresos generado exitosamente');
    } catch (error) {
      console.error('Error en reporte ingresos por sede:', error);
      errorResponse(res, 'Error al generar reporte', null, 500);
    }
  }

  /**
   * Reporte de Análisis Más Solicitados
   * GET /api/reportes/analisis-ranking
   */
  async getAnalisisRanking(req: Request, res: Response): Promise<void> {
    try {
      const sedesUsuario = await this.getSedesUsuario(req.user?.userId, req.user?.rolId);
      
      const filtros: FiltrosReporte = {
        fecha_inicio: req.query.fecha_inicio as string,
        fecha_fin: req.query.fecha_fin as string,
        sede_ids: sedesUsuario,
      };

      const reporte = await reportesService.getAnalisisRanking(filtros);
      successResponse(res, reporte, 'Reporte de análisis generado exitosamente');
    } catch (error) {
      console.error('Error en reporte análisis ranking:', error);
      errorResponse(res, 'Error al generar reporte', null, 500);
    }
  }

  /**
   * Reporte de Productividad por Usuario
   * GET /api/reportes/productividad
   */
  async getProductividadUsuarios(req: Request, res: Response): Promise<void> {
    try {
      const sedesUsuario = await this.getSedesUsuario(req.user?.userId, req.user?.rolId);
      
      const filtros: FiltrosReporte = {
        fecha_inicio: req.query.fecha_inicio as string,
        fecha_fin: req.query.fecha_fin as string,
        sede_ids: sedesUsuario,
      };

      const reporte = await reportesService.getProductividadUsuarios(filtros);
      successResponse(res, reporte, 'Reporte de productividad generado exitosamente');
    } catch (error) {
      console.error('Error en reporte productividad:', error);
      errorResponse(res, 'Error al generar reporte', null, 500);
    }
  }
}

export const reportesController = new ReportesController();
