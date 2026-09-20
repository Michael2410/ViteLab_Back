import pool from '../../config/database';
import { emitEvent } from '../../config/socket';
import { iaService, type OrdenParaIA, type AnalisisParaIA } from '../ia/ia.service';
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

      // Verificar que la orden existe y está en estado válido para ingresar resultados
      const ordenCheck = await client.query(
        `SELECT id, estado FROM ordenes WHERE id = $1`,
        [data.orden_id]
      );

      if (ordenCheck.rows.length === 0) {
        throw new Error('La orden no existe');
      }

      const estadosPermitidos = ['REGISTRADA', 'MUESTRA_RECIBIDA'];
      if (!estadosPermitidos.includes(ordenCheck.rows[0].estado)) {
        throw new Error('Solo se pueden ingresar resultados en órdenes REGISTRADAS o con MUESTRA_RECIBIDA');
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
               updated_at = NOW()
           WHERE id = $1`,
          [data.orden_id]
        );
      }

      await client.query('COMMIT');

      if (resultadosCreados.length > 0) {
        emitEvent('dashboard:update');
      }

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
        oa.orden_id,
        o.numero_atencion,
        a.nombre as analisis_nombre,
        u.nombres as usuario_registro_nombre
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
        oa.orden_id,
        o.numero_atencion,
        a.nombre as analisis_nombre,
        u.nombres as usuario_registro_nombre
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
    // Obtener datos básicos de la orden con información completa
    const ordenQuery = `
      SELECT 
        o.id,
        o.numero_atencion,
        o.estado,
        o.fecha_registro,
        o.fecha_aprobacion,
        o.medico,
        o.usuario_aprobacion_id,
        o.interpretacion_ia,
        p.nombres as paciente_nombres,
        p.apellido_paterno,
        p.apellido_materno,
        p.dni as paciente_dni,
        p.genero as paciente_genero,
        p.fecha_nacimiento as paciente_fecha_nacimiento,
        s.nombre as sede_nombre,
        tc.nombre as tipo_cliente_nombre,
        c.nombre_empresa as convenio_nombre,
        c.direccion as convenio_direccion,
        c.logo_url as convenio_logo_url,
        uapro.nombres as aprobado_por_nombres,
        uapro.apellidos as aprobado_por_apellidos,
        uapro.firma_url as aprobado_por_firma_url
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      INNER JOIN tipos_cliente tc ON o.tipo_cliente_id = tc.id
      LEFT JOIN convenios c ON o.convenio_id = c.id
      LEFT JOIN usuarios uapro ON o.usuario_aprobacion_id = uapro.id
      WHERE o.id = $1
    `;

    const ordenResult = await pool.query(ordenQuery, [ordenId]);

    if (ordenResult.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const ordenRow = ordenResult.rows[0];
    const orden = {
      ...ordenRow,
      paciente_apellidos: `${ordenRow.apellido_paterno} ${ordenRow.apellido_materno}`
    };

    // Obtener análisis de la orden con sus componentes
    // Los componentes están vinculados a analisis mediante analisis.componentes_ids (array)
    // Nota: analisis no tiene area_id, el área está en los componentes
    const analisisQuery = `
      SELECT 
        oa.id as orden_analisis_id,
        oa.analisis_id,
        a.nombre as analisis_nombre,
        a.componentes_ids
      FROM orden_analisis oa
      INNER JOIN analisis a ON oa.analisis_id = a.id
      WHERE oa.orden_id = $1
      ORDER BY a.nombre
    `;

    const analisisResult = await pool.query(analisisQuery, [ordenId]);

    const analisisList: AnalisisConComponentes[] = [];

    for (const analisisRow of analisisResult.rows) {
      const componentesIds = analisisRow.componentes_ids || [];
      
      // Obtener componentes de este análisis
      let componentes: any[] = [];
      if (componentesIds.length > 0) {
        const componentesQuery = `
          SELECT 
            c.id as componente_id,
            c.nombre as componente_nombre,
            c.unidad_medida,
            c.valores_referenciales,
            c.valor_alerta_min,
            c.valor_alerta_max,
            m.nombre as metodo_nombre,
            r.id as resultado_id,
            r.resultado as resultado_valor,
            r.observacion as resultado_observaciones
          FROM componentes c
          LEFT JOIN metodos m ON c.metodo_id = m.id
          LEFT JOIN resultados r ON r.componente_id = c.id AND r.orden_analisis_id = $1
          WHERE c.id = ANY($2) AND c.activo = true
          ORDER BY array_position($2, c.id)
        `;
        
        const componentesResult = await pool.query(componentesQuery, [
          analisisRow.orden_analisis_id,
          componentesIds
        ]);
        
        componentes = componentesResult.rows.map(row => ({
          componente_id: row.componente_id,
          componente_nombre: row.componente_nombre,
          unidad_medida: row.unidad_medida,
          valores_referenciales: row.valores_referenciales || [],
          valor_alerta_min: row.valor_alerta_min ? parseFloat(row.valor_alerta_min) : null,
          valor_alerta_max: row.valor_alerta_max ? parseFloat(row.valor_alerta_max) : null,
          metodo_nombre: row.metodo_nombre,
          resultado_id: row.resultado_id,
          resultado_valor: row.resultado_valor,
          resultado_observaciones: row.resultado_observaciones,
          tiene_resultado: row.resultado_id !== null,
        }));
      }

      analisisList.push({
        orden_analisis_id: analisisRow.orden_analisis_id,
        analisis_id: analisisRow.analisis_id,
        analisis_nombre: analisisRow.analisis_nombre,
        componentes,
      });
    }

    return {
      ...orden,
      analisis: analisisList,
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

    const resultadoActualizado = await this.getResultadoById(id);
    emitEvent('resultado:actualizado', { resultado: resultadoActualizado });
    emitEvent('dashboard:update');
    return resultadoActualizado;
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

  // ============================================
  // OBTENER ÓRDENES PARA INGRESO DE RESULTADOS
  // (estado MUESTRA_RECIBIDA o REGISTRADA con muestra_recepcionada)
  // ============================================

  async getOrdenesParaResultados(sedeIds?: number[]): Promise<any[]> {
    let query = `
      SELECT 
        o.id,
        o.numero_atencion,
        o.estado,
        o.fecha_registro,
        o.fecha_recepcion,
        o.muestra_recepcionada,
        p.dni as paciente_dni,
        p.nombres as paciente_nombres,
        p.apellido_paterno,
        p.apellido_materno,
        s.nombre as sede_nombre,
        (SELECT COUNT(*) FROM orden_analisis WHERE orden_id = o.id) as total_analisis
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      WHERE (o.estado = 'MUESTRA_RECIBIDA' 
         OR (o.estado = 'REGISTRADA' AND o.muestra_recepcionada = true))
    `;
    
    const params: any[] = [];
    
    // Filtrar por sedes del usuario si tiene asignadas
    if (sedeIds && sedeIds.length > 0) {
      params.push(sedeIds);
      query += ` AND o.sede_id = ANY($${params.length}::int[])`;
    }
    
    query += ` ORDER BY o.fecha_registro DESC`;

    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      ...row,
      paciente_apellidos: `${row.apellido_paterno} ${row.apellido_materno}`
    }));
  }

  // ============================================
  // OBTENER ÓRDENES PENDIENTES DE APROBACIÓN (estado = CON_RESULTADOS)
  // ============================================

  async getOrdenesPendientesAprobacion(sedeIds?: number[]): Promise<any[]> {
    let query = `
      SELECT 
        o.id,
        o.numero_atencion,
        o.estado,
        o.fecha_registro,
        o.muestra_recepcionada,
        p.dni as paciente_dni,
        p.nombres as paciente_nombres,
        p.apellido_paterno,
        p.apellido_materno,
        s.nombre as sede_nombre,
        (SELECT COUNT(*) FROM orden_analisis WHERE orden_id = o.id) as total_analisis
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      WHERE o.estado = 'CON_RESULTADOS'
    `;
    
    const params: any[] = [];
    
    // Filtrar por sedes del usuario si tiene asignadas
    if (sedeIds && sedeIds.length > 0) {
      params.push(sedeIds);
      query += ` AND o.sede_id = ANY($${params.length}::int[])`;
    }
    
    query += ` ORDER BY o.fecha_registro DESC`;

    const result = await pool.query(query, params);
    
    return result.rows.map(row => ({
      ...row,
      paciente_apellidos: `${row.apellido_paterno} ${row.apellido_materno}`
    }));
  }

  // ============================================
  // APROBAR ORDEN (Guardar resultados y cambiar estado a APROBADA)
  // ============================================

  async aprobarOrden(
    ordenId: number,
    resultados: BulkResultadosInput['resultados'],
    usuarioId: number
  ): Promise<{ message: string }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que la orden existe
      const ordenCheck = await client.query(
        `SELECT id, estado FROM ordenes WHERE id = $1`,
        [ordenId]
      );

      if (ordenCheck.rows.length === 0) {
        throw new Error('La orden no existe');
      }

      // Guardar o actualizar resultados
      for (const resultado of resultados) {
        // Verificar si ya existe un resultado para este componente
        const existeQuery = `
          SELECT id FROM resultados 
          WHERE orden_analisis_id = $1 AND componente_id = $2
        `;
        const existe = await client.query(existeQuery, [
          resultado.orden_analisis_id,
          resultado.componente_id,
        ]);

        if (existe.rows.length > 0) {
          // Actualizar resultado existente
          await client.query(
            `UPDATE resultados 
             SET resultado = $1, observacion = $2, updated_at = NOW()
             WHERE id = $3`,
            [resultado.valor, resultado.observaciones || null, existe.rows[0].id]
          );
        } else {
          // Insertar nuevo resultado
          await client.query(
            `INSERT INTO resultados (
              orden_analisis_id,
              componente_id,
              resultado,
              usuario_registro_id
            ) VALUES ($1, $2, $3, $4)`,
            [
              resultado.orden_analisis_id,
              resultado.componente_id,
              resultado.valor,
              usuarioId,
            ]
          );
        }
      }

      // Cambiar estado a APROBADA
      await client.query(
        `UPDATE ordenes 
         SET estado = 'APROBADA', 
             fecha_aprobacion = NOW(),
             usuario_aprobacion_id = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [usuarioId, ordenId]
      );

      await client.query('COMMIT');

      emitEvent('resultado:aprobado', { ordenId });
      emitEvent('dashboard:update');

      // ✨ Generar interpretación IA en segundo plano (sin bloquear la respuesta)
      this.generarInterpretacionIA(ordenId).catch(err => {
        console.error('Error al generar interpretación IA:', err);
      });

      return { message: 'Orden aprobada exitosamente' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // GUARDAR RESULTADOS SIN APROBAR
  // ============================================

  async guardarResultados(
    ordenId: number,
    resultados: BulkResultadosInput['resultados'],
    usuarioId: number
  ): Promise<{ message: string; guardados: number }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que la orden existe
      const ordenCheck = await client.query(
        `SELECT id, estado FROM ordenes WHERE id = $1`,
        [ordenId]
      );

      if (ordenCheck.rows.length === 0) {
        throw new Error('La orden no existe');
      }

      let guardados = 0;

      // Guardar o actualizar resultados
      for (const resultado of resultados) {
        if (!resultado.valor || resultado.valor.trim() === '') continue;

        // Verificar si ya existe un resultado para este componente
        const existeQuery = `
          SELECT id FROM resultados 
          WHERE orden_analisis_id = $1 AND componente_id = $2
        `;
        const existe = await client.query(existeQuery, [
          resultado.orden_analisis_id,
          resultado.componente_id,
        ]);

        if (existe.rows.length > 0) {
          // Actualizar resultado existente
          await client.query(
            `UPDATE resultados 
             SET resultado = $1, observacion = $2, updated_at = NOW()
             WHERE id = $3`,
            [resultado.valor, resultado.observaciones || null, existe.rows[0].id]
          );
        } else {
          // Insertar nuevo resultado
          await client.query(
            `INSERT INTO resultados (
              orden_analisis_id,
              componente_id,
              resultado,
              usuario_registro_id
            ) VALUES ($1, $2, $3, $4)`,
            [
              resultado.orden_analisis_id,
              resultado.componente_id,
              resultado.valor,
              usuarioId,
            ]
          );
        }
        guardados++;
      }

      // Cambiar estado de la orden a CON_RESULTADOS si se guardaron resultados
      // Se actualiza desde REGISTRADA o MUESTRA_RECIBIDA
      if (guardados > 0) {
        await client.query(
          `UPDATE ordenes 
           SET estado = 'CON_RESULTADOS', updated_at = NOW()
           WHERE id = $1 AND estado IN ('REGISTRADA', 'MUESTRA_RECIBIDA')`,
          [ordenId]
        );
      }

      await client.query('COMMIT');

      if (guardados > 0) {
        emitEvent('resultado:guardado', { ordenId, guardados });
        emitEvent('dashboard:update');
      }

      return { message: 'Resultados guardados exitosamente', guardados };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // GENERAR INTERPRETACIÓN IA
  // ============================================

  private async generarInterpretacionIA(ordenId: number): Promise<void> {
    try {
      // Obtener datos completos de la orden con resultados
      const orden = await this.getOrdenConResultados(ordenId);
      
      // Calcular edad del paciente
      let edadPaciente = 0;
      if (orden.paciente_fecha_nacimiento) {
        const fechaNac = new Date(orden.paciente_fecha_nacimiento);
        const hoy = new Date();
        edadPaciente = hoy.getFullYear() - fechaNac.getFullYear();
        const m = hoy.getMonth() - fechaNac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
          edadPaciente--;
        }
      }

      // Preparar datos para la IA (solo componentes con resultados)
      const ordenParaIA: OrdenParaIA = {
        id: orden.id,
        numero_atencion: String(orden.numero_atencion),
        paciente_nombres: orden.paciente_nombres,
        paciente_apellidos: orden.paciente_apellidos,
        paciente_genero: orden.paciente_genero || 'M',
        paciente_edad: edadPaciente,
        analisis: orden.analisis.map((a): AnalisisParaIA => ({
          analisis_nombre: a.analisis_nombre,
          componentes: a.componentes
            .filter(c => c.tiene_resultado && c.resultado_valor)
            .map(c => ({
              componente_nombre: c.componente_nombre,
              resultado_valor: c.resultado_valor || '',
              unidad_medida: c.unidad_medida || null,
              valores_referenciales: c.valores_referenciales || []
            }))
        })).filter(a => a.componentes.length > 0) // Solo análisis con resultados
      };

      // Generar y guardar interpretación
      await iaService.procesarInterpretacion(ordenParaIA);

    } catch (error) {
      console.error(`Error en generarInterpretacionIA para orden ${ordenId}:`, error);
      // No lanzamos error para no afectar el flujo principal
    }
  }
}

export const resultadosService = new ResultadosService();
