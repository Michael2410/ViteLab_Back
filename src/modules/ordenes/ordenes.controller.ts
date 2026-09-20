import type { Request, Response } from 'express';
import { ordenesService } from './ordenes.service';
import { dniApiService } from './dni-api.service';
import { successResponse, errorResponse } from '../../utils/response.utils';
import type { EstadoOrden } from './ordenes.types';

export class OrdenesController {
  // Buscar paciente en BD local por DNI
  async buscarPacientePorDni(req: Request, res: Response): Promise<void> {
    try {
      const { dni } = req.params;
      const paciente = await ordenesService.getPacienteByDni(dni);

      if (!paciente) {
        res.status(404).json({
          success: false,
          message: 'Paciente no encontrado en el sistema',
          data: null,
        });
        return;
      }

      successResponse(res, paciente, 'Paciente encontrado');
    } catch (error) {
      errorResponse(res, 'Error al buscar paciente', error);
    }
  }

  // Consultar DNI desde API externa
  async consultarDni(req: Request, res: Response): Promise<void> {
    try {
      const { dni } = req.params;
      const resultado = await dniApiService.consultarDni(dni);

      if (!resultado.success) {
        res.status(404).json({
          success: false,
          message: resultado.message || 'No se encontraron datos para el DNI',
        });
        return;
      }

      successResponse(res, resultado.data, 'Datos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al consultar DNI', error);
    }
  }

  // Crear nueva orden
  async create(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Restaurar autenticación después de desarrollo
      // Por ahora usar usuario 1 (admin) si no hay autenticación
      const usuarioId = req.user?.userId || 1;

      console.log('📥 Datos recibidos para crear orden:', JSON.stringify(req.body, null, 2));

      const orden = await ordenesService.createOrden(req.body, usuarioId);
      successResponse(res, orden, 'Orden creada exitosamente', 201);
    } catch (error: any) {
      console.error('❌ Error al crear orden:', error);
      errorResponse(res, error.message || 'Error al crear orden', error);
    }
  }

  // Obtener orden por ID
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const orden = await ordenesService.getOrdenById(id);
      successResponse(res, orden, 'Orden obtenida exitosamente');
    } catch (error: any) {
      if (error.message === 'Orden no encontrada') {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      errorResponse(res, 'Error al obtener orden', error);
    }
  }

  // Listar órdenes con filtros
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      console.log('📋 [ORDENES] Recibiendo petición GET /api/ordenes');
      console.log('📋 [ORDENES] Query params:', req.query);
      console.log('📋 [ORDENES] Usuario:', req.user?.userId);
      
      // Obtener sedes del usuario autenticado
      const usuarioId = req.user?.userId;
      let sedesUsuario: number[] | undefined;
      
      if (usuarioId) {
        const sedesResult = await import('../../config/database').then(m => 
          m.pool.query('SELECT sede_id FROM usuarios_sedes WHERE usuario_id = $1', [usuarioId])
        );
        if (sedesResult.rows.length > 0) {
          sedesUsuario = sedesResult.rows.map((r: any) => r.sede_id);
          console.log('📋 [ORDENES] Sedes del usuario:', sedesUsuario);
        }
      }
      
      const filters = {
        estado: req.query.estado as EstadoOrden | undefined,
        sede_id: req.query.sede_id ? parseInt(req.query.sede_id as string) : undefined,
        sede_ids: sedesUsuario, // Filtrar por sedes del usuario
        fecha_desde: req.query.fecha_desde ? new Date(req.query.fecha_desde as string) : undefined,
        fecha_hasta: req.query.fecha_hasta ? new Date(req.query.fecha_hasta as string) : undefined,
        paciente_dni: req.query.paciente_dni as string | undefined,
        paciente_nombre: req.query.paciente_nombre as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };

      console.log('📋 [ORDENES] Filtros procesados:', filters);
      const result = await ordenesService.getOrdenes(filters);
      console.log('📋 [ORDENES] Resultado obtenido:', { total: result.total, items: result.items.length });
      console.log('✅ [ORDENES] Enviando respuesta exitosa');
      successResponse(res, result, 'Órdenes obtenidas exitosamente');
    } catch (error) {
      console.error('❌ [ORDENES] Error al obtener órdenes:', error);
      errorResponse(res, 'Error al obtener órdenes', error);
    }
  }

  // Actualizar orden
  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const orden = await ordenesService.updateOrden(id, req.body);
      successResponse(res, orden, 'Orden actualizada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al actualizar orden', error);
    }
  }

  // Actualizar estado de orden
  async updateEstado(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const { estado } = req.body;
      const usuarioId = req.user?.userId;

      if (!usuarioId) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado' });
        return;
      }

      const orden = await ordenesService.updateEstadoOrden(id, estado, usuarioId);
      successResponse(res, orden, `Orden marcada como ${estado} exitosamente`);
    } catch (error) {
      errorResponse(res, 'Error al actualizar estado de orden', error);
    }
  }

  // Eliminar orden
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await ordenesService.deleteOrden(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: 'Orden no encontrada' });
        return;
      }

      successResponse(res, null, 'Orden eliminada exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al eliminar orden', error);
    }
  }

  // Recepcionar muestra
  async recepcionarMuestra(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const usuarioId = req.user?.userId || 1;
      const orden = await ordenesService.recepcionarMuestra(id, usuarioId);
      successResponse(res, orden, 'Muestra recepcionada exitosamente');
    } catch (error: any) {
      if (error.message === 'Orden no encontrada o no está en estado REGISTRADA') {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      errorResponse(res, 'Error al recepcionar muestra', error);
    }
  }

  // Obtener precios de análisis según tarifario
  async obtenerPrecios(req: Request, res: Response): Promise<void> {
    try {
      const { analisis_ids, convenio_id } = req.body;
      const precios = await ordenesService.obtenerPreciosAnalisis(
        analisis_ids,
        convenio_id || undefined
      );
      successResponse(res, precios, 'Precios obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener precios', error);
    }
  }

  // Obtener lista de médicos únicos
  async getMedicos(_req: Request, res: Response): Promise<void> {
    try {
      const medicos = await ordenesService.getMedicos();
      successResponse(res, medicos, 'Médicos obtenidos exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener médicos', error);
    }
  }

  // Obtener conteo de alertas (órdenes aprobadas y pendientes de aprobar)
  async getAlertasCounts(_req: Request, res: Response): Promise<void> {
    try {
      const alertas = await ordenesService.getAlertasCounts();
      successResponse(res, alertas, 'Alertas obtenidas exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al obtener alertas', error);
    }
  }

  // Marcar orden como impresa
  async marcarComoImpreso(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const orden = await ordenesService.marcarComoImpreso(id);

      if (!orden) {
        res.status(404).json({ 
          success: false, 
          message: 'Orden no encontrada o no está en estado aprobada' 
        });
        return;
      }

      successResponse(res, orden, 'Orden marcada como impresa exitosamente');
    } catch (error) {
      errorResponse(res, 'Error al marcar orden como impresa', error);
    }
  }

  // Obtener o generar condiciones pre-analíticas con IA
  async getPreanalitica(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const preanalitica = await ordenesService.obtenerOCrearPreanalitica(id);
      successResponse(res, { condiciones_preanaliticas: preanalitica }, 'Condiciones pre-analíticas obtenidas exitosamente');
    } catch (error: any) {
      errorResponse(res, error.message || 'Error al obtener condiciones pre-analíticas', error);
    }
  }
}

export const ordenesController = new OrdenesController();
