import pool from '../../config/database';
import type {
  ResultadoDetalle,
  CreateResultadoInput,
  UpdateResultadoInput,
  BulkResultadosInput,
  ResultadosFilters,
  OrdenConResultados,
  AnalisisConComponentes,
} from './resultados.types';

class ResultadosService {
  // ============================================
  // CREAR RESULTADO INDIVIDUAL
  // ============================================

  async createResultado(
    data: CreateResultadoInput,
    usuarioId: number
  ): Promise<ResultadoDetalle> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que el orden_analisis existe
      const ordenAnalisisCheck = await client.query(
        'SELECT id, orden_id FROM orden_analisis WHERE id = $1',
        [data.orden_analisis_id]
      );

      if (ordenAnalisisCheck.rows.length === 0) {
        throw new Error('La orden-análisis no existe');
      }

      // Verificar que el componente existe
      const componenteCheck = await client.query(
        'SELECT id FROM componentes WHERE id = $1 AND activo = true',
        [data.componente_id]
      );

      if (componenteCheck.rows.length === 0) {
        throw new Error('El componente no existe o está inactivo');
      }

      // Verificar si ya existe un resultado para este componente en esta orden-análisis
      const resultadoExistente = await client.query(
        'SELECT id FROM resultados WHERE orden_analisis_id = $1 AND componente_id = $2',
        [data.orden_analisis_id, data.componente_id]
      );

      if (resultadoExistente.rows.length > 0) {
        throw new Error('Ya existe un resultado para este componente');
      }

      // Crear resultado
      const resultadoQuery = `
        INSERT INTO resultados (
          orden_analisis_id,
          componente_id,
          valor,
          unidad_medida,
          observaciones,
          usuario_registro_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const resultadoResult = await client.query(resultadoQuery, [
        data.orden_analisis_id,
        data.componente_id,
        data.valor,
        data.unidad_medida || null,
        data.observaciones || null,
        usuarioId,
      ]);

      await client.query('COMMIT');

      // Obtener el resultado completo con sus relaciones
      return await this.getResultadoById(resultadoResult.rows[0].id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // CREAR MÚLTIPLES RESULTADOS (BULK)
  // ============================================

  async createBulkResultados(
    data: BulkResultadosInput,
    usuarioId: number
  ): Promise<{ created: number; resultados: ResultadoDetalle[] }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que la orden existe y está en estado REGISTRADA
      const ordenCheck = await client.query(
        `SELECT id, estado FROM ordenes WHERE id = $1`,
        [data.orden_id]
      );

      if (ordenCheck.rows.length === 0) {
        throw new Error('La orden no existe');
      }

      if (ordenCheck.rows[0].estado !== 'REGISTRADA') {
        throw new Error('Solo se pueden ingresar resultados en órdenes REGISTRADAS');
      }

      const resultadosCreados: ResultadoDetalle[] = [];

      // Insertar cada resultado
      for (const resultado of data.resultados) {
        // Verificar que no exista ya un resultado para este componente
        const existeQuery = `
          SELECT id FROM resultados 
          WHERE orden_analisis_id = $1 AND componente_id = $2
        `;
        const existe = await client.query(existeQuery, [
          resultado.orden_analisis_id,
          resultado.componente_id,
        ]);

        if (existe.rows.length === 0) {
          const insertQuery = `
            INSERT INTO resultados (
              orden_analisis_id,
              componente_id,
              valor,
              unidad_medida,
              observaciones,
              usuario_registro_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `;

          const insertResult = await client.query(insertQuery, [
            resultado.orden_analisis_id,
            resultado.componente_id,
            resultado.valor,
            resultado.unidad_medida || null,
            resultado.observaciones || null,
            usuarioId,
          ]);

          const resultadoDetalle = await this.getResultadoById(
            insertResult.rows[0].id
          );
          resultadosCreados.push(resultadoDetalle);
        }
      }

      // Cambiar estado de la orden a CON_RESULTADOS si se ingresaron resultados
      if (resultadosCreados.length > 0) {
        await client.query(
          `UPDATE ordenes 
           SET estado = 'CON_RESULTADOS', 
               fecha_resultados = NOW(),
               usuario_resultados_id = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [usuarioId, data.orden_id]
        );
      }

      await client.query('COMMIT');

      return {
        created: resultadosCreados.length,
        resultados: resultadosCreados,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // OBTENER RESULTADO POR ID
  // ============================================

  async getResultadoById(id: number): Promise<ResultadoDetalle> {
    const query = `
      SELECT 
        r.*,
        c.nombre as componente_nombre,
        c.codigo as componente_codigo,
        oa.orden_id,
        o.numero_orden,
        a.nombre as analisis_nombre,
        u.nombre as usuario_registro_nombre
      FROM resultados r
      INNER JOIN componentes c ON r.componente_id = c.id
      INNER JOIN orden_analisis oa ON r.orden_analisis_id = oa.id
      INNER JOIN ordenes o ON oa.orden_id = o.id
      INNER JOIN analisis a ON oa.analisis_id = a.id
      LEFT JOIN usuarios u ON r.usuario_registro_id = u.id
      WHERE r.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Resultado no encontrado');
    }

    return result.rows[0];
  }

  // ============================================
  // OBTENER RESULTADOS CON FILTROS
  // ============================================

  async getResultados(filters: ResultadosFilters): Promise<ResultadoDetalle[]> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.orden_id) {
      conditions.push(`oa.orden_id = $${paramIndex}`);
      params.push(filters.orden_id);
      paramIndex++;
    }

    if (filters.orden_analisis_id) {
      conditions.push(`r.orden_analisis_id = $${paramIndex}`);
      params.push(filters.orden_analisis_id);
      paramIndex++;
    }

    if (filters.componente_id) {
      conditions.push(`r.componente_id = $${paramIndex}`);
      params.push(filters.componente_id);
      paramIndex++;
    }

    const query = `
      SELECT 
        r.*,
        c.nombre as componente_nombre,
        c.codigo as componente_codigo,
        oa.orden_id,
        o.numero_orden,
        a.nombre as analisis_nombre,
        u.nombre as usuario_registro_nombre
      FROM resultados r
      INNER JOIN componentes c ON r.componente_id = c.id
      INNER JOIN orden_analisis oa ON r.orden_analisis_id = oa.id
      INNER JOIN ordenes o ON oa.orden_id = o.id
      INNER JOIN analisis a ON oa.analisis_id = a.id
      LEFT JOIN usuarios u ON r.usuario_registro_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // ============================================
  // OBTENER ORDEN CON TODOS SUS RESULTADOS
  // ============================================

  async getOrdenConResultados(ordenId: number): Promise<OrdenConResultados> {
    // Obtener datos básicos de la orden
    const ordenQuery = `
      SELECT 
        o.id,
        o.numero_orden,
        o.fecha_registro,
        p.nombres as paciente_nombres,
        p.apellidos as paciente_apellidos,
        p.dni as paciente_dni
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      WHERE o.id = $1
    `;

    const ordenResult = await pool.query(ordenQuery, [ordenId]);

    if (ordenResult.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const orden = ordenResult.rows[0];

    // Obtener análisis con sus componentes y resultados
    const analisisQuery = `
      SELECT 
        oa.id as orden_analisis_id,
        oa.analisis_id,
        a.codigo as analisis_codigo,
        a.nombre as analisis_nombre,
        c.id as componente_id,
        c.codigo as componente_codigo,
        c.nombre as componente_nombre,
        c.unidad_medida,
        c.valor_referencia_min,
        c.valor_referencia_max,
        c.valor_referencia_texto,
        r.id as resultado_id,
        r.valor as resultado_valor,
        r.observaciones as resultado_observaciones
      FROM orden_analisis oa
      INNER JOIN analisis a ON oa.analisis_id = a.id
      LEFT JOIN componentes c ON c.analisis_id = a.id
      LEFT JOIN resultados r ON r.orden_analisis_id = oa.id AND r.componente_id = c.id
      WHERE oa.orden_id = $1
      ORDER BY a.nombre, c.orden
    `;

    const analisisResult = await pool.query(analisisQuery, [ordenId]);

    // Agrupar por análisis
    const analisisMap = new Map<number, AnalisisConComponentes>();

    for (const row of analisisResult.rows) {
      if (!analisisMap.has(row.analisis_id)) {
        analisisMap.set(row.analisis_id, {
          orden_analisis_id: row.orden_analisis_id,
          analisis_id: row.analisis_id,
          analisis_codigo: row.analisis_codigo,
          analisis_nombre: row.analisis_nombre,
          componentes: [],
        });
      }

      const analisis = analisisMap.get(row.analisis_id)!;

      if (row.componente_id) {
        analisis.componentes.push({
          componente_id: row.componente_id,
          componente_codigo: row.componente_codigo,
          componente_nombre: row.componente_nombre,
          unidad_medida: row.unidad_medida,
          valor_referencia_min: row.valor_referencia_min,
          valor_referencia_max: row.valor_referencia_max,
          valor_referencia_texto: row.valor_referencia_texto,
          resultado_id: row.resultado_id,
          resultado_valor: row.resultado_valor,
          resultado_observaciones: row.resultado_observaciones,
          tiene_resultado: row.resultado_id !== null,
        });
      }
    }

    return {
      ...orden,
      analisis: Array.from(analisisMap.values()),
    };
  }

  // ============================================
  // ACTUALIZAR RESULTADO
  // ============================================

  async updateResultado(
    id: number,
    data: UpdateResultadoInput
  ): Promise<ResultadoDetalle> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.valor !== undefined) {
      updates.push(`valor = $${paramIndex}`);
      params.push(data.valor);
      paramIndex++;
    }

    if (data.unidad_medida !== undefined) {
      updates.push(`unidad_medida = $${paramIndex}`);
      params.push(data.unidad_medida || null);
      paramIndex++;
    }

    if (data.observaciones !== undefined) {
      updates.push(`observaciones = $${paramIndex}`);
      params.push(data.observaciones || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new Error('No hay datos para actualizar');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE resultados
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      throw new Error('Resultado no encontrado');
    }

    return await this.getResultadoById(id);
  }

  // ============================================
  // ELIMINAR RESULTADO
  // ============================================

  async deleteResultado(id: number): Promise<void> {
    const result = await pool.query('DELETE FROM resultados WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      throw new Error('Resultado no encontrado');
    }
  }
}

export const resultadosService = new ResultadosService();
