import pool from '../../config/database';
import type {
  FiltrosReporte,
  ReporteOrdenesPeriodo,
  ReporteIngresosSede,
  ReporteAnalisisRanking,
  ReporteProductividad,
} from './reportes.types';

class ReportesService {
  /**
   * Reporte de Órdenes por Período
   */
  async getOrdenesPorPeriodo(filtros: FiltrosReporte): Promise<ReporteOrdenesPeriodo> {
    let query = `
      SELECT 
        o.id,
        o.numero_atencion,
        o.fecha_registro,
        o.estado,
        o.tipo_paciente,
        p.dni as paciente_dni,
        p.nombres as paciente_nombres,
        CONCAT(p.apellido_paterno, ' ', p.apellido_materno) as paciente_apellidos,
        s.nombre as sede_nombre,
        c.nombre_empresa as convenio_nombre,
        (SELECT COUNT(*) FROM orden_analisis WHERE orden_id = o.id) as total_analisis,
        COALESCE(
          (SELECT SUM(oa.precio) FROM orden_analisis oa WHERE oa.orden_id = o.id),
          0
        ) as monto_total
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      LEFT JOIN convenios c ON o.convenio_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (filtros.fecha_inicio) {
      params.push(filtros.fecha_inicio);
      query += ` AND DATE(o.fecha_registro) >= $${paramCount++}`;
    }

    if (filtros.fecha_fin) {
      params.push(filtros.fecha_fin);
      query += ` AND DATE(o.fecha_registro) <= $${paramCount++}`;
    }

    if (filtros.sede_id) {
      params.push(filtros.sede_id);
      query += ` AND o.sede_id = $${paramCount++}`;
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      params.push(filtros.sede_ids);
      query += ` AND o.sede_id = ANY($${paramCount++}::int[])`;
    }

    if (filtros.estado) {
      params.push(filtros.estado);
      query += ` AND o.estado = $${paramCount++}`;
    }

    query += ` ORDER BY o.fecha_registro DESC`;

    const result = await pool.query(query, params);
    const ordenes = result.rows;

    // Calcular totales
    const totales = {
      cantidad: ordenes.length,
      monto_total: ordenes.reduce((acc, o) => acc + parseFloat(o.monto_total || 0), 0),
      por_estado: this.agruparPor(ordenes, 'estado'),
      por_tipo_paciente: this.agruparPorTipo(ordenes, 'tipo_paciente'),
    };

    return { ordenes, totales };
  }

  /**
   * Reporte de Ingresos por Sede
   */
  async getIngresosPorSede(filtros: FiltrosReporte): Promise<ReporteIngresosSede> {
    let query = `
      SELECT 
        s.id as sede_id,
        s.nombre as sede_nombre,
        COUNT(o.id) as cantidad_ordenes,
        COALESCE(SUM(
          (SELECT SUM(oa.precio) FROM orden_analisis oa WHERE oa.orden_id = o.id)
        ), 0) as monto_total
      FROM sedes s
      LEFT JOIN ordenes o ON s.id = o.sede_id
    `;

    const params: any[] = [];
    let paramCount = 1;
    const conditions: string[] = ['s.activo = true'];

    if (filtros.fecha_inicio) {
      params.push(filtros.fecha_inicio);
      conditions.push(`(o.fecha_registro IS NULL OR DATE(o.fecha_registro) >= $${paramCount++})`);
    }

    if (filtros.fecha_fin) {
      params.push(filtros.fecha_fin);
      conditions.push(`(o.fecha_registro IS NULL OR DATE(o.fecha_registro) <= $${paramCount++})`);
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      params.push(filtros.sede_ids);
      conditions.push(`s.id = ANY($${paramCount++}::int[])`);
    }

    query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` GROUP BY s.id, s.nombre ORDER BY monto_total DESC`;

    const result = await pool.query(query, params);

    const sedes = result.rows.map(row => ({
      sede_id: row.sede_id,
      sede_nombre: row.sede_nombre,
      cantidad_ordenes: parseInt(row.cantidad_ordenes) || 0,
      monto_total: parseFloat(row.monto_total) || 0,
      promedio_por_orden: row.cantidad_ordenes > 0 
        ? parseFloat(row.monto_total) / parseInt(row.cantidad_ordenes) 
        : 0,
    }));

    const total_general = {
      cantidad_ordenes: sedes.reduce((acc, s) => acc + s.cantidad_ordenes, 0),
      monto_total: sedes.reduce((acc, s) => acc + s.monto_total, 0),
    };

    return { sedes, total_general };
  }

  /**
   * Reporte de Análisis Más Solicitados
   */
  async getAnalisisRanking(filtros: FiltrosReporte): Promise<ReporteAnalisisRanking> {
    let query = `
      SELECT 
        a.id as analisis_id,
        a.nombre as analisis_nombre,
        COALESCE(
          (SELECT ar.nombre FROM componentes c 
           INNER JOIN areas ar ON c.area_id = ar.id 
           WHERE c.analisis_id = a.id LIMIT 1),
          'Sin área'
        ) as area_nombre,
        COUNT(oa.id) as cantidad_solicitudes
      FROM analisis a
      LEFT JOIN orden_analisis oa ON a.id = oa.analisis_id
      LEFT JOIN ordenes o ON oa.orden_id = o.id
      WHERE a.activo = true
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (filtros.fecha_inicio) {
      params.push(filtros.fecha_inicio);
      query += ` AND (o.fecha_registro IS NULL OR DATE(o.fecha_registro) >= $${paramCount++})`;
    }

    if (filtros.fecha_fin) {
      params.push(filtros.fecha_fin);
      query += ` AND (o.fecha_registro IS NULL OR DATE(o.fecha_registro) <= $${paramCount++})`;
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      params.push(filtros.sede_ids);
      query += ` AND (o.sede_id IS NULL OR o.sede_id = ANY($${paramCount++}::int[]))`;
    }

    query += ` GROUP BY a.id, a.nombre`;
    query += ` ORDER BY cantidad_solicitudes DESC`;
    query += ` LIMIT 20`;

    const result = await pool.query(query, params);
    
    const total_solicitudes = result.rows.reduce(
      (acc, row) => acc + parseInt(row.cantidad_solicitudes), 
      0
    );

    const analisis = result.rows.map(row => ({
      analisis_id: row.analisis_id,
      analisis_nombre: row.analisis_nombre,
      analisis_codigo: '', // No hay código en la tabla
      area_nombre: row.area_nombre,
      cantidad_solicitudes: parseInt(row.cantidad_solicitudes),
      porcentaje: total_solicitudes > 0 
        ? (parseInt(row.cantidad_solicitudes) / total_solicitudes) * 100 
        : 0,
    }));

    return { analisis, total_solicitudes };
  }

  /**
   * Reporte de Productividad por Usuario
   */
  async getProductividadUsuarios(filtros: FiltrosReporte): Promise<ReporteProductividad> {
    let baseCondition = '';
    const params: any[] = [];
    let paramCount = 1;

    if (filtros.fecha_inicio) {
      params.push(filtros.fecha_inicio);
      baseCondition += ` AND DATE(o.fecha_registro) >= $${paramCount++}`;
    }

    if (filtros.fecha_fin) {
      params.push(filtros.fecha_fin);
      baseCondition += ` AND DATE(o.fecha_registro) <= $${paramCount++}`;
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      params.push(filtros.sede_ids);
      baseCondition += ` AND o.sede_id = ANY($${paramCount++}::int[])`;
    }

    const query = `
      SELECT 
        u.id as usuario_id,
        CONCAT(u.nombres, ' ', u.apellido_paterno) as usuario_nombre,
        (
          SELECT COUNT(*) FROM ordenes o 
          WHERE o.usuario_id = u.id ${baseCondition.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n)}`)}
        ) as ordenes_registradas,
        (
          SELECT COUNT(DISTINCT r.id) FROM resultados r
          INNER JOIN orden_analisis oa ON r.orden_analisis_id = oa.id
          INNER JOIN ordenes o ON oa.orden_id = o.id
          WHERE r.usuario_registro_id = u.id ${baseCondition.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + params.length}`)}
        ) as resultados_ingresados,
        (
          SELECT COUNT(*) FROM ordenes o 
          WHERE o.usuario_aprobacion_id = u.id ${baseCondition.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + params.length * 2}`)}
        ) as ordenes_aprobadas
      FROM usuarios u
      WHERE u.activo = true
      ORDER BY ordenes_registradas DESC
    `;

    // Para simplificar, haremos consultas separadas
    const usersQuery = `
      SELECT id, CONCAT(nombres, ' ', apellidos) as nombre 
      FROM usuarios WHERE activo = true
    `;
    const usersResult = await pool.query(usersQuery);

    const usuarios = await Promise.all(
      usersResult.rows.map(async (user) => {
        // Órdenes registradas
        let ordenesQuery = `
          SELECT COUNT(*) as count FROM ordenes o WHERE o.usuario_registro_id = $1
        `;
        const ordenesParams = [user.id];
        let pCount = 2;

        if (filtros.fecha_inicio) {
          ordenesParams.push(filtros.fecha_inicio);
          ordenesQuery += ` AND DATE(o.fecha_registro) >= $${pCount++}`;
        }
        if (filtros.fecha_fin) {
          ordenesParams.push(filtros.fecha_fin);
          ordenesQuery += ` AND DATE(o.fecha_registro) <= $${pCount++}`;
        }
        if (filtros.sede_ids && filtros.sede_ids.length > 0) {
          ordenesParams.push(filtros.sede_ids as any);
          ordenesQuery += ` AND o.sede_id = ANY($${pCount++}::int[])`;
        }

        const ordenesResult = await pool.query(ordenesQuery, ordenesParams);

        // Resultados ingresados
        let resultadosQuery = `
          SELECT COUNT(DISTINCT r.id) as count FROM resultados r
          INNER JOIN orden_analisis oa ON r.orden_analisis_id = oa.id
          INNER JOIN ordenes o ON oa.orden_id = o.id
          WHERE r.usuario_registro_id = $1
        `;
        const resultadosParams = [user.id];
        pCount = 2;

        if (filtros.fecha_inicio) {
          resultadosParams.push(filtros.fecha_inicio);
          resultadosQuery += ` AND DATE(o.fecha_registro) >= $${pCount++}`;
        }
        if (filtros.fecha_fin) {
          resultadosParams.push(filtros.fecha_fin);
          resultadosQuery += ` AND DATE(o.fecha_registro) <= $${pCount++}`;
        }
        if (filtros.sede_ids && filtros.sede_ids.length > 0) {
          resultadosParams.push(filtros.sede_ids as any);
          resultadosQuery += ` AND o.sede_id = ANY($${pCount++}::int[])`;
        }

        const resultadosResult = await pool.query(resultadosQuery, resultadosParams);

        // Órdenes aprobadas
        let aprobadasQuery = `
          SELECT COUNT(*) as count FROM ordenes o WHERE o.usuario_aprobacion_id = $1
        `;
        const aprobadasParams = [user.id];
        pCount = 2;

        if (filtros.fecha_inicio) {
          aprobadasParams.push(filtros.fecha_inicio);
          aprobadasQuery += ` AND DATE(o.fecha_registro) >= $${pCount++}`;
        }
        if (filtros.fecha_fin) {
          aprobadasParams.push(filtros.fecha_fin);
          aprobadasQuery += ` AND DATE(o.fecha_registro) <= $${pCount++}`;
        }
        if (filtros.sede_ids && filtros.sede_ids.length > 0) {
          aprobadasParams.push(filtros.sede_ids as any);
          aprobadasQuery += ` AND o.sede_id = ANY($${pCount++}::int[])`;
        }

        const aprobadasResult = await pool.query(aprobadasQuery, aprobadasParams);

        return {
          usuario_id: user.id,
          usuario_nombre: user.nombre,
          ordenes_registradas: parseInt(ordenesResult.rows[0].count),
          resultados_ingresados: parseInt(resultadosResult.rows[0].count),
          ordenes_aprobadas: parseInt(aprobadasResult.rows[0].count),
        };
      })
    );

    // Filtrar usuarios sin actividad
    const usuariosActivos = usuarios.filter(
      u => u.ordenes_registradas > 0 || u.resultados_ingresados > 0 || u.ordenes_aprobadas > 0
    );

    const totales = {
      ordenes_registradas: usuariosActivos.reduce((acc, u) => acc + u.ordenes_registradas, 0),
      resultados_ingresados: usuariosActivos.reduce((acc, u) => acc + u.resultados_ingresados, 0),
      ordenes_aprobadas: usuariosActivos.reduce((acc, u) => acc + u.ordenes_aprobadas, 0),
    };

    return { usuarios: usuariosActivos, totales };
  }

  // Helpers
  private agruparPor(items: any[], campo: string): { estado: string; cantidad: number }[] {
    const grupos: Record<string, number> = {};
    items.forEach(item => {
      const valor = item[campo] || 'Sin definir';
      grupos[valor] = (grupos[valor] || 0) + 1;
    });
    return Object.entries(grupos).map(([estado, cantidad]) => ({ estado, cantidad }));
  }

  private agruparPorTipo(items: any[], campo: string): { tipo: string; cantidad: number }[] {
    const grupos: Record<string, number> = {};
    items.forEach(item => {
      const valor = item[campo] || 'PARTICULAR';
      grupos[valor] = (grupos[valor] || 0) + 1;
    });
    return Object.entries(grupos).map(([tipo, cantidad]) => ({ tipo, cantidad }));
  }
}

export const reportesService = new ReportesService();
