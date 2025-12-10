import pool from '../../config/database';
import type { ConfiguracionSistema, UpdateConfiguracionInput } from './sistema.types';

class SistemaService {
  /**
   * Obtener la configuración del sistema
   * Siempre retorna el primer (y único) registro
   */
  async getConfiguracion(): Promise<ConfiguracionSistema | null> {
    const result = await pool.query(
      `SELECT * FROM configuracion_sistema ORDER BY id LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      // Si no existe, crear un registro por defecto
      const insert = await pool.query(
        `INSERT INTO configuracion_sistema (empresa_nombre) 
         VALUES ('LABORATORIO') 
         RETURNING *`
      );
      return insert.rows[0];
    }
    
    return result.rows[0];
  }

  /**
   * Actualizar la configuración del sistema
   */
  async updateConfiguracion(data: UpdateConfiguracionInput): Promise<ConfiguracionSistema> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.empresa_nombre !== undefined) {
      fields.push(`empresa_nombre = $${paramCount++}`);
      values.push(data.empresa_nombre);
    }
    if (data.empresa_razon_social !== undefined) {
      fields.push(`empresa_razon_social = $${paramCount++}`);
      values.push(data.empresa_razon_social);
    }
    if (data.empresa_ruc !== undefined) {
      fields.push(`empresa_ruc = $${paramCount++}`);
      values.push(data.empresa_ruc);
    }
    if (data.empresa_direccion !== undefined) {
      fields.push(`empresa_direccion = $${paramCount++}`);
      values.push(data.empresa_direccion);
    }
    if (data.empresa_telefono !== undefined) {
      fields.push(`empresa_telefono = $${paramCount++}`);
      values.push(data.empresa_telefono);
    }
    if (data.empresa_email !== undefined) {
      fields.push(`empresa_email = $${paramCount++}`);
      values.push(data.empresa_email);
    }
    if (data.empresa_web !== undefined) {
      fields.push(`empresa_web = $${paramCount++}`);
      values.push(data.empresa_web);
    }
    if (data.logo_principal !== undefined) {
      fields.push(`logo_principal = $${paramCount++}`);
      values.push(data.logo_principal);
    }
    if (data.logo_secundario !== undefined) {
      fields.push(`logo_secundario = $${paramCount++}`);
      values.push(data.logo_secundario);
    }
    if (data.encabezado_reporte !== undefined) {
      fields.push(`encabezado_reporte = $${paramCount++}`);
      values.push(data.encabezado_reporte);
    }
    if (data.pie_reporte !== undefined) {
      fields.push(`pie_reporte = $${paramCount++}`);
      values.push(data.pie_reporte);
    }
    if (data.moneda !== undefined) {
      fields.push(`moneda = $${paramCount++}`);
      values.push(data.moneda);
    }
    if (data.igv_porcentaje !== undefined) {
      fields.push(`igv_porcentaje = $${paramCount++}`);
      values.push(data.igv_porcentaje);
    }

    if (fields.length === 0) {
      const current = await this.getConfiguracion();
      return current!;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    // Obtener el ID del registro existente
    const existingResult = await pool.query(
      `SELECT id FROM configuracion_sistema ORDER BY id LIMIT 1`
    );
    
    let id: number;
    if (existingResult.rows.length === 0) {
      // Crear registro si no existe
      const insert = await pool.query(
        `INSERT INTO configuracion_sistema (empresa_nombre) 
         VALUES ('LABORATORIO') 
         RETURNING id`
      );
      id = insert.rows[0].id;
    } else {
      id = existingResult.rows[0].id;
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE configuracion_sistema 
       SET ${fields.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Obtener estadísticas del dashboard por sede
   */
  async getDashboardStats(sedeIds?: number[]): Promise<{
    sedes: Array<{
      id: number;
      nombre: string;
      color: string;
      ordenes_hoy: number;
      ordenes_pendientes: number;
      ordenes_con_resultados: number;
      ordenes_aprobadas: number;
    }>;
    totales: {
      ordenes_hoy: number;
      pendientes_resultados: number;
      con_resultados: number;
      aprobadas: number;
    };
  }> {
    // Colores para las sedes
    const colores = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa541c'];
    
    // Obtener todas las sedes activas (o filtradas por usuario)
    let sedesQuery = `SELECT id, nombre FROM sedes WHERE activo = true`;
    const sedesParams: any[] = [];
    
    if (sedeIds && sedeIds.length > 0) {
      sedesParams.push(sedeIds);
      sedesQuery += ` AND id = ANY($1::int[])`;
    }
    
    sedesQuery += ` ORDER BY nombre`;
    
    const sedesResult = await pool.query(sedesQuery, sedesParams);
    
    // Para cada sede, obtener estadísticas
    const sedesStats = await Promise.all(
      sedesResult.rows.map(async (sede, index) => {
        // Órdenes de hoy
        const hoyResult = await pool.query(
          `SELECT COUNT(*) as count FROM ordenes 
           WHERE sede_id = $1 AND DATE(fecha_registro) = CURRENT_DATE`,
          [sede.id]
        );
        
        // Órdenes pendientes de resultados (MUESTRA_RECIBIDA)
        const pendientesResult = await pool.query(
          `SELECT COUNT(*) as count FROM ordenes 
           WHERE sede_id = $1 AND estado = 'MUESTRA_RECIBIDA'`,
          [sede.id]
        );
        
        // Órdenes con resultados
        const conResultadosResult = await pool.query(
          `SELECT COUNT(*) as count FROM ordenes 
           WHERE sede_id = $1 AND estado = 'CON_RESULTADOS'`,
          [sede.id]
        );
        
        // Órdenes aprobadas hoy
        const aprobadasResult = await pool.query(
          `SELECT COUNT(*) as count FROM ordenes 
           WHERE sede_id = $1 AND estado = 'APROBADA' AND DATE(fecha_registro) = CURRENT_DATE`,
          [sede.id]
        );
        
        return {
          id: sede.id,
          nombre: sede.nombre,
          color: colores[index % colores.length],
          ordenes_hoy: parseInt(hoyResult.rows[0].count),
          ordenes_pendientes: parseInt(pendientesResult.rows[0].count),
          ordenes_con_resultados: parseInt(conResultadosResult.rows[0].count),
          ordenes_aprobadas: parseInt(aprobadasResult.rows[0].count),
        };
      })
    );
    
    // Calcular totales
    const totales = sedesStats.reduce(
      (acc, sede) => ({
        ordenes_hoy: acc.ordenes_hoy + sede.ordenes_hoy,
        pendientes_resultados: acc.pendientes_resultados + sede.ordenes_pendientes,
        con_resultados: acc.con_resultados + sede.ordenes_con_resultados,
        aprobadas: acc.aprobadas + sede.ordenes_aprobadas,
      }),
      { ordenes_hoy: 0, pendientes_resultados: 0, con_resultados: 0, aprobadas: 0 }
    );
    
    return { sedes: sedesStats, totales };
  }
}

export const sistemaService = new SistemaService();
