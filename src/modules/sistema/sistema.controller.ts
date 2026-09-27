import { Request, Response } from 'express';
import { sistemaService } from './sistema.service';
import { db, usuariosSedes } from '../../db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '../../utils/response.utils';
import type { UpdateConfiguracionInput } from './sistema.types';

class SistemaController {
  /**
   * Obtener configuración del sistema
   * GET /api/sistema/configuracion
   */
  async getConfiguracion(_req: Request, res: Response): Promise<void> {
    try {
      const configuracion = await sistemaService.getConfiguracion();
      successResponse(res, configuracion, 'Configuración obtenida exitosamente');
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      errorResponse(res, 'Error al obtener configuración del sistema', null, 500);
    }
  }

  /**
   * Actualizar configuración del sistema
   * PUT /api/sistema/configuracion
   */
  async updateConfiguracion(req: Request, res: Response): Promise<void> {
    try {
      const data: UpdateConfiguracionInput = req.body;
      const configuracion = await sistemaService.updateConfiguracion(data);
      successResponse(res, configuracion, 'Configuración actualizada exitosamente');
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      errorResponse(res, 'Error al actualizar configuración del sistema', null, 500);
    }
  }

  /**
   * Obtener estadísticas del dashboard
   * GET /api/sistema/dashboard
   */
  async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      // Obtener sedes del usuario autenticado
      const usuarioId = req.user?.userId;
      let sedesUsuario: number[] | undefined;
      
      if (usuarioId) {
        const sedesResult = await db
          .select({ sedeId: usuariosSedes.sede_id })
          .from(usuariosSedes)
          .where(eq(usuariosSedes.usuario_id, usuarioId));
        if (sedesResult.length > 0) {
          sedesUsuario = sedesResult.map((r) => r.sedeId);
        }
      }

      const stats = await sistemaService.getDashboardStats(sedesUsuario);
      successResponse(res, stats, 'Estadísticas obtenidas exitosamente');
    } catch (error) {
      console.error('Error al obtener estadísticas del dashboard:', error);
      errorResponse(res, 'Error al obtener estadísticas', null, 500);
    }
  }
}

export const sistemaController = new SistemaController();
