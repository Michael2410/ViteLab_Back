import { Request, Response } from 'express';
import { reportesService } from './reportes.service';
import pool from '../../config/database';
import { successResponse, errorResponse } from '../../utils/response.utils';
import type { FiltrosReporte } from './reportes.types';

class ReportesController {
  /**
   * Obtener sedes del usuario para filtros
   */
  private async getSedesUsuario(usuarioId?: number): Promise<number[] | undefined> {
    if (!usuarioId) return undefined;
    
    const result = await pool.query(
      'SELECT sede_id FROM usuarios_sedes WHERE usuario_id = $1',
      [usuarioId]
    );
    
    return result.rows.length > 0 
      ? result.rows.map(r => r.sede_id) 
      : undefined;
  }

  /**
   * Reporte de Órdenes por Período
   * GET /api/reportes/ordenes-periodo
   */
  async getOrdenesPorPeriodo(req: Request, res: Response): Promise<void> {
    try {
      const sedesUsuario = await this.getSedesUsuario(req.user?.userId);
      
      const filtros: FiltrosReporte = {
        fecha_inicio: req.query.fecha_inicio as string,
        fecha_fin: req.query.fecha_fin as string,
        sede_id: req.query.sede_id ? parseInt(req.query.sede_id as string) : undefined,
        sede_ids: sedesUsuario,
        estado: req.query.estado as string,
      };

      const reporte = await reportesService.getOrdenesPorPeriodo(filtros);
      successResponse(res, reporte, 'Reporte de órdenes generado exitosamente');
    } catch (error) {
      console.error('Error en reporte órdenes por período:', error);
      errorResponse(res, 'Error al generar reporte', null, 500);
    }
  }

  /**
   * Reporte de Ingresos por Sede
   * GET /api/reportes/ingresos-sede
   */
  async getIngresosPorSede(req: Request, res: Response): Promise<void> {
    try {
      const sedesUsuario = await this.getSedesUsuario(req.user?.userId);
      
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
      const sedesUsuario = await this.getSedesUsuario(req.user?.userId);
      
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
      const sedesUsuario = await this.getSedesUsuario(req.user?.userId);
      
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
