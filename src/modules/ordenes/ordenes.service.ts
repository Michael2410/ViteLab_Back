import { pool } from '../../config/database';
import { emitEvent } from '../../config/socket';
import { iaService } from '../ia/ia.service';
import type {
  Paciente,
  CreatePacienteInput,
  Orden,
  CreateOrdenInput,
  UpdateOrdenInput,
  OrdenDetalle,
  OrdenFilters,
  EstadoOrden,
} from './ordenes.types';
import type { PaginatedResponse } from '../../types/api.types';

export class OrdenesService {
  // ========== PACIENTES ==========
  
  async createPaciente(data: CreatePacienteInput): Promise<Paciente> {
    const nombreCompleto = `${data.apellido_paterno} ${data.apellido_materno}, ${data.nombres}`;
    const result = await pool.query(
      `INSERT INTO pacientes (dni, nombres, apellido_paterno, apellido_materno, nombre_completo, fecha_nacimiento, genero, telefono, email, direccion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.dni,
        data.nombres,
        data.apellido_paterno,
        data.apellido_materno,
        nombreCompleto,
        data.fecha_nacimiento,
        data.genero,
        data.telefono || null,
        data.email || null,
        data.direccion || null,
      ]
    );
    return result.rows[0];
  }

  async getPacienteByDni(dni: string): Promise<Paciente | null> {
    const result = await pool.query('SELECT * FROM pacientes WHERE dni = $1', [dni]);
    return result.rows[0] || null;
  }

  // ========== ÓRDENES ==========
  
  async createOrden(data: CreateOrdenInput, usuarioId: number): Promise<OrdenDetalle> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Crear o obtener paciente
      let paciente: Paciente | null = await this.getPacienteByDni(data.paciente.dni);
      if (!paciente) {
        const nombreCompleto = `${data.paciente.apellido_paterno} ${data.paciente.apellido_materno}, ${data.paciente.nombres}`;
        const pacienteResult = await client.query(
          `INSERT INTO pacientes (dni, nombres, apellido_paterno, apellido_materno, nombre_completo, fecha_nacimiento, genero, telefono, email, direccion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            data.paciente.dni,
            data.paciente.nombres,
            data.paciente.apellido_paterno,
            data.paciente.apellido_materno,
            nombreCompleto,
            data.paciente.fecha_nacimiento,
            data.paciente.genero,
            data.paciente.telefono || null,
            data.paciente.email || null,
            data.paciente.direccion || null,
          ]
        );
        paciente = pacienteResult.rows[0] as Paciente;
      }

      if (!paciente) {
        throw new Error('Error al crear o recuperar paciente');
      }

      // 2. Generar número de atención único
      const numeroAtencion = await this.generateNumeroOrden();

      // 3. Obtener precios de análisis según convenio/tarifario
      const analisisIds = data.analisis.map(a => a.id);
      const precios = await this.calcularPrecios(analisisIds, data.convenio_id);
      const total = precios.reduce((sum, p) => sum + p.precio, 0);

      // 4. Crear orden
      const ordenResult = await client.query(
        `INSERT INTO ordenes (
          numero_atencion, paciente_id, sede_id, tipo_cliente_id, convenio_id,
          estado, nota, usuario_registro_id, muestra_recepcionada, medico
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          numeroAtencion,
          paciente.id,
          data.sede_id,
          data.tipo_cliente_id,
          data.convenio_id || null,
          'REGISTRADA',
          data.nota || null,
          usuarioId,
          false, // muestra_recepcionada = false por defecto
          data.medico || null,
        ]
      );
      const orden = ordenResult.rows[0];

      // 5. Crear orden_analisis con precios y muestras_ids
      for (const analisisItem of data.analisis) {
        const precioCalculado = precios.find(p => p.analisis_id === analisisItem.id)?.precio || 0;
        const precioFinal = (analisisItem.precio !== undefined && analisisItem.precio !== null)
          ? analisisItem.precio
          : precioCalculado;
        await client.query(
          'INSERT INTO orden_analisis (orden_id, analisis_id, precio, muestras_ids) VALUES ($1, $2, $3, $4)',
          [orden.id, analisisItem.id, precioFinal, analisisItem.muestras_ids || []]
        );
      }

      await client.query('COMMIT');

      // ✨ Generar condiciones pre-analíticas con IA en segundo plano
      this.generarCondicionesPreanaliticasIA(orden.id, paciente, data.analisis).catch(err => {
        console.error('Error al generar condiciones pre-analíticas IA:', err);
      });

      // 6. Obtener orden completa con detalles
      const ordenDetalle = await this.getOrdenById(orden.id);
      emitEvent('orden:creada', { orden: ordenDetalle });
      emitEvent('dashboard:update');
      return ordenDetalle;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrdenById(id: number): Promise<OrdenDetalle> {
    const result = await pool.query(
      `SELECT 
        o.id,
        o.numero_atencion,
        o.paciente_id,
        o.sede_id,
        o.tipo_cliente_id,
        o.convenio_id,
        o.usuario_registro_id,
        o.estado,
        o.nota,
        o.medico,
        o.tipo_paciente,
        o.fecha_registro,
        o.fecha_recepcion,
        o.usuario_recepcion_id,
        o.fecha_aprobacion,
        o.usuario_aprobacion_id,
        o.muestra_recepcionada,
        o.condiciones_preanaliticas,
        o.created_at,
        o.updated_at,
        json_build_object(
          'id', p.id,
          'dni', p.dni,
          'nombres', p.nombres,
          'apellido_paterno', p.apellido_paterno,
          'apellido_materno', p.apellido_materno,
          'nombre_completo', p.nombre_completo,
          'fecha_nacimiento', p.fecha_nacimiento,
          'genero', p.genero,
          'telefono', p.telefono,
          'email', p.email,
          'direccion', p.direccion
        ) as paciente,
        json_build_object(
          'id', s.id,
          'nombre', s.nombre,
          'direccion', s.direccion
        ) as sede,
        json_build_object(
          'id', tc.id,
          'nombre', tc.nombre
        ) as tipo_cliente,
        CASE WHEN o.convenio_id IS NOT NULL THEN
          json_build_object(
            'id', c.id,
            'nombre_empresa', c.nombre_empresa,
            'tarifario_id', c.tarifario_id
          )
        ELSE NULL END as convenio,
        json_build_object(
          'id', ur.id,
          'nombres', ur.nombres,
          'apellidos', ur.apellidos
        ) as usuario_registro,
        CASE WHEN o.usuario_recepcion_id IS NOT NULL THEN
          json_build_object(
            'id', urec.id,
            'nombres', urec.nombres,
            'apellidos', urec.apellidos
          )
        ELSE NULL END as usuario_recepcion,
        CASE WHEN o.usuario_aprobacion_id IS NOT NULL THEN
          json_build_object(
            'id', uapro.id,
            'nombres', uapro.nombres,
            'apellidos', uapro.apellidos
          )
        ELSE NULL END as usuario_aprobacion
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      INNER JOIN tipos_cliente tc ON o.tipo_cliente_id = tc.id
      LEFT JOIN convenios c ON o.convenio_id = c.id
      INNER JOIN usuarios ur ON o.usuario_registro_id = ur.id
      LEFT JOIN usuarios urec ON o.usuario_recepcion_id = urec.id
      LEFT JOIN usuarios uapro ON o.usuario_aprobacion_id = uapro.id
      WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Orden no encontrada');
    }

    const orden = result.rows[0];

    // Obtener análisis de la orden
    const analisisResult = await pool.query(
      `SELECT 
        oa.id,
        oa.analisis_id,
        a.nombre,
        oa.precio,
        oa.muestras_ids
      FROM orden_analisis oa
      INNER JOIN analisis a ON oa.analisis_id = a.id
      WHERE oa.orden_id = $1
      ORDER BY a.nombre`,
      [id]
    );

    return {
      ...orden,
      analisis: analisisResult.rows,
    };
  }

  async updateOrden(id: number, data: UpdateOrdenInput): Promise<OrdenDetalle> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Verificar existencia de la orden
      const ordenActualRes = await client.query('SELECT * FROM ordenes WHERE id = $1', [id]);
      if (ordenActualRes.rows.length === 0) {
        throw new Error('Orden no encontrada');
      }
      const ordenActual = ordenActualRes.rows[0];

      // 2. Actualizar datos del paciente si fueron provistos
      if (data.paciente) {
        const nombreCompleto = `${data.paciente.apellido_paterno} ${data.paciente.apellido_materno}, ${data.paciente.nombres}`;
        await client.query(
          `UPDATE pacientes SET 
            nombres = $1, 
            apellido_paterno = $2, 
            apellido_materno = $3, 
            nombre_completo = $4, 
            fecha_nacimiento = $5, 
            genero = $6, 
            telefono = $7, 
            email = $8, 
            direccion = $9,
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $10`,
          [
            data.paciente.nombres,
            data.paciente.apellido_paterno,
            data.paciente.apellido_materno,
            nombreCompleto,
            data.paciente.fecha_nacimiento,
            data.paciente.genero,
            data.paciente.telefono || null,
            data.paciente.email || null,
            data.paciente.direccion || null,
            ordenActual.paciente_id,
          ]
        );
      }

      // 3. Actualizar cabecera de la orden
      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];
      let pIdx = 1;

      if (data.sede_id !== undefined) {
        updates.push(`sede_id = $${pIdx++}`);
        values.push(data.sede_id);
      }
      if (data.tipo_cliente_id !== undefined) {
        updates.push(`tipo_cliente_id = $${pIdx++}`);
        values.push(data.tipo_cliente_id);
      }
      if (data.convenio_id !== undefined) {
        updates.push(`convenio_id = $${pIdx++}`);
        values.push(data.convenio_id || null);
      }
      if (data.medico !== undefined) {
        updates.push(`medico = $${pIdx++}`);
        values.push(data.medico || null);
      }
      if (data.nota !== undefined) {
        updates.push(`nota = $${pIdx++}`);
        values.push(data.nota || null);
      }

      values.push(id);
      await client.query(
        `UPDATE ordenes SET ${updates.join(', ')} WHERE id = $${pIdx}`,
        values
      );

      // 4. Sincronización diferencial de análisis si fueron provistos
      if (data.analisis && Array.isArray(data.analisis)) {
        const analisisActualesRes = await client.query(
          'SELECT id, analisis_id, precio, muestras_ids FROM orden_analisis WHERE orden_id = $1',
          [id]
        );
        const analisisActuales = analisisActualesRes.rows;
        const nuevosAnalisisIds = new Set(data.analisis.map((a) => a.id));

        // A. Eliminar análisis retirados de la orden (y sus resultados asociados)
        const paraEliminar = analisisActuales.filter((oa) => !nuevosAnalisisIds.has(oa.analisis_id));
        for (const oa of paraEliminar) {
          await client.query('DELETE FROM resultados WHERE orden_analisis_id = $1', [oa.id]);
          await client.query('DELETE FROM orden_analisis WHERE id = $1', [oa.id]);
        }

        // B. Precios de referencia según tarifario
        const convenioId = data.convenio_id !== undefined ? data.convenio_id : ordenActual.convenio_id;
        const analisisIds = data.analisis.map((a) => a.id);
        const preciosTarifario = await this.calcularPrecios(analisisIds, convenioId);

        // C. Procesar cada análisis (actualizar existentes o insertar nuevos)
        for (const item of data.analisis) {
          const precioCalculado = preciosTarifario.find((p) => p.analisis_id === item.id)?.precio || 0;
          const precioFinal = (item.precio !== undefined && item.precio !== null)
            ? item.precio
            : precioCalculado;

          const existente = analisisActuales.find((oa) => oa.analisis_id === item.id);
          if (existente) {
            // Actualizar precio y muestras sin tocar resultados existentes
            await client.query(
              `UPDATE orden_analisis SET precio = $1, muestras_ids = $2 WHERE id = $3`,
              [precioFinal, item.muestras_ids || [], existente.id]
            );
          } else {
            // Insertar nuevo análisis agregado a la orden
            await client.query(
              `INSERT INTO orden_analisis (orden_id, analisis_id, precio, muestras_ids) VALUES ($1, $2, $3, $4)`,
              [id, item.id, precioFinal, item.muestras_ids || []]
            );
          }
        }
      }

      await client.query('COMMIT');

      // 5. Retornar orden actualizada
      const ordenDetalle = await this.getOrdenById(id);
      emitEvent('orden:actualizada', { orden: ordenDetalle });
      emitEvent('dashboard:update');
      return ordenDetalle;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrdenes(filters: OrdenFilters): Promise<PaginatedResponse<Orden>> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    console.log('🔍 [ORDENES SERVICE] Construyendo query con page:', page, 'limit:', limit, 'offset:', offset);

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramCount = 1;

    if (filters.estado) {
      conditions.push(`o.estado = $${paramCount++}`);
      values.push(filters.estado);
      console.log('🔍 [ORDENES SERVICE] Filtrando por estado:', filters.estado);
    }
    if (filters.sede_id) {
      conditions.push(`o.sede_id = $${paramCount++}`);
      values.push(filters.sede_id);
    }
    // Filtrar por sedes del usuario (si tiene sedes asignadas)
    if (filters.sede_ids && filters.sede_ids.length > 0) {
      conditions.push(`o.sede_id = ANY($${paramCount++})`);
      values.push(filters.sede_ids);
      console.log('🔍 [ORDENES SERVICE] Filtrando por sedes del usuario:', filters.sede_ids);
    }
    if (filters.fecha_desde) {
      conditions.push(`o.fecha_registro >= $${paramCount++}`);
      values.push(filters.fecha_desde);
    }
    if (filters.fecha_hasta) {
      conditions.push(`o.fecha_registro <= $${paramCount++}`);
      values.push(filters.fecha_hasta);
    }
    if (filters.paciente_dni) {
      conditions.push(`p.dni LIKE $${paramCount++}`);
      values.push(`%${filters.paciente_dni}%`);
    }
    if (filters.paciente_nombre) {
      conditions.push(`(p.nombres ILIKE $${paramCount} OR p.apellido_paterno ILIKE $${paramCount} OR p.apellido_materno ILIKE $${paramCount})`);
      values.push(`%${filters.paciente_nombre}%`);
      paramCount++;
    }

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ordenes o
       INNER JOIN pacientes p ON o.paciente_id = p.id
       WHERE ${conditions.join(' AND ')}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get items
    values.push(limit, offset);
    const result = await pool.query(
      `SELECT 
        o.id,
        o.numero_atencion,
        o.paciente_id,
        o.sede_id,
        o.tipo_cliente_id,
        o.convenio_id,
        o.estado,
        o.muestra_recepcionada,
        o.condiciones_preanaliticas,
        o.fecha_registro,
        o.fecha_recepcion,
        o.tipo_paciente,
        o.nota,
        o.medico,
        o.usuario_registro_id,
        o.usuario_recepcion_id,
        o.created_at,
        o.updated_at,
        p.dni as paciente_dni,
        p.nombres as paciente_nombres,
        CONCAT(p.apellido_paterno, ' ', p.apellido_materno) as paciente_apellidos,
        p.telefono as paciente_telefono,
        s.nombre as sede_nombre,
        tc.nombre as tipo_cliente_nombre,
        c.nombre_empresa as convenio_nombre,
        urec.nombres as usuario_recepcion_nombres,
        urec.apellidos as usuario_recepcion_apellidos,
        COALESCE(SUM(oa.precio), 0) as total
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      INNER JOIN tipos_cliente tc ON o.tipo_cliente_id = tc.id
      LEFT JOIN convenios c ON o.convenio_id = c.id
      LEFT JOIN orden_analisis oa ON o.id = oa.orden_id
      LEFT JOIN usuarios urec ON o.usuario_recepcion_id = urec.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.id, o.muestra_recepcionada, o.condiciones_preanaliticas, o.medico, o.tipo_paciente, o.fecha_recepcion, o.usuario_recepcion_id, 
               p.dni, p.nombres, p.apellido_paterno, p.apellido_materno, p.telefono, s.nombre, tc.nombre, c.nombre_empresa,
               urec.nombres, urec.apellidos
      ORDER BY o.fecha_registro DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      values
    );

    const items = result.rows.map(row => ({
      id: row.id,
      numero_atencion: row.numero_atencion,
      paciente_id: row.paciente_id,
      sede_id: row.sede_id,
      tipo_cliente_id: row.tipo_cliente_id,
      convenio_id: row.convenio_id,
      estado: row.estado,
      muestra_recepcionada: row.muestra_recepcionada || false,
      fecha_registro: row.fecha_registro,
      fecha_recepcion: row.fecha_recepcion,
      tipo_paciente: row.tipo_paciente,
      total: parseFloat(row.total || 0),
      nota: row.nota,
      medico: row.medico,
      condiciones_preanaliticas: row.condiciones_preanaliticas,
      usuario_registro_id: row.usuario_registro_id,
      usuario_recepcion_id: row.usuario_recepcion_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Campos adicionales para la vista
      paciente_dni: row.paciente_dni,
      paciente_nombres: row.paciente_nombres,
      paciente_apellidos: row.paciente_apellidos,
      paciente_telefono: row.paciente_telefono || null,
      sede_nombre: row.sede_nombre,
      tipo_cliente_nombre: row.tipo_cliente_nombre,
      convenio_nombre: row.convenio_nombre,
      usuario_recepcion_nombre: row.usuario_recepcion_nombres && row.usuario_recepcion_apellidos 
        ? `${row.usuario_recepcion_nombres} ${row.usuario_recepcion_apellidos}` 
        : null,
    }));

    return {
      items,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateEstadoOrden(
    id: number,
    estado: EstadoOrden,
    usuarioId: number
  ): Promise<Orden> {
    let updateFields = 'estado = $1, updated_at = CURRENT_TIMESTAMP';
    const values: any[] = [estado];

    if (estado === 'MUESTRA_RECIBIDA') {
      updateFields += ', muestra_recepcionada = true, fecha_recepcion = CURRENT_TIMESTAMP, usuario_recepcion_id = $2';
      values.push(usuarioId);
    } else if (estado === 'CON_RESULTADOS') {
      updateFields += ', fecha_resultados = CURRENT_TIMESTAMP, usuario_resultados_id = $2';
      values.push(usuarioId);
    } else if (estado === 'APROBADA') {
      updateFields += ', fecha_aprobacion = CURRENT_TIMESTAMP, usuario_aprobacion_id = $2';
      values.push(usuarioId);
    }

    values.push(id);
    const paramCount = values.length;

    const result = await pool.query(
      `UPDATE ordenes SET ${updateFields} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    const ordenActualizada = result.rows[0];
    emitEvent('orden:estado_cambiado', { orden: ordenActualizada });
    emitEvent('dashboard:update');
    return ordenActualizada;
  }

  async deleteOrden(id: number): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Eliminar orden_analisis
      await client.query('DELETE FROM orden_analisis WHERE orden_id = $1', [id]);

      // Eliminar orden
      const result = await client.query('DELETE FROM ordenes WHERE id = $1 RETURNING id', [id]);

      await client.query('COMMIT');
      if (result.rows.length > 0) {
        emitEvent('orden:eliminada', { ordenId: id });
        emitEvent('dashboard:update');
      }
      return result.rows.length > 0;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recepcionarMuestra(id: number, usuarioId: number): Promise<Orden> {
    console.log('🔵 [RECEPCIONAR] Iniciando recepción para orden:', id, 'usuario:', usuarioId);
    try {
      const result = await pool.query(
        `UPDATE ordenes 
         SET muestra_recepcionada = true, 
             estado = 'MUESTRA_RECIBIDA',
             usuario_recepcion_id = $2,
             fecha_recepcion = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND estado = 'REGISTRADA'
         RETURNING *`,
        [id, usuarioId]
      );

      console.log('🟢 [RECEPCIONAR] Resultado:', result.rows.length > 0 ? 'OK' : 'No rows');

      if (result.rows.length === 0) {
        throw new Error('Orden no encontrada o no está en estado REGISTRADA');
      }

      const ordenActualizada = result.rows[0];
      emitEvent('orden:estado_cambiado', { orden: ordenActualizada });
      emitEvent('dashboard:update');

      return ordenActualizada;
    } catch (error: any) {
      console.error('❌ [RECEPCIONAR] Error:', error.message);
      throw error;
    }
  }

  // ========== HELPERS ==========

  private async generateNumeroOrden(): Promise<number> {
    // Obtener el último número de atención
    const result = await pool.query(
      `SELECT COALESCE(MAX(numero_atencion), 0) + 1 as siguiente FROM ordenes`
    );
    
    return result.rows[0].siguiente;
  }

  /**
   * Calcular precios para análisis según tarifario (público)
   */
  async obtenerPreciosAnalisis(
    analisisIds: number[],
    convenioId?: number
  ): Promise<Array<{ analisis_id: number; nombre: string; precio: number }>> {
    const precios: Array<{ analisis_id: number; nombre: string; precio: number }> = [];
    let tarifarioId: number | null = null;

    if (convenioId) {
      // Obtener tarifario del convenio
      const convenioResult = await pool.query(
        'SELECT tarifario_id FROM convenios WHERE id = $1',
        [convenioId]
      );

      if (convenioResult.rows.length === 0 || !convenioResult.rows[0].tarifario_id) {
        throw new Error('Convenio no tiene tarifario asignado');
      }

      tarifarioId = convenioResult.rows[0].tarifario_id;
    } else {
      // Sin convenio (Particular), usar Tarifario General
      const tarifarioGeneralResult = await pool.query(
        "SELECT id FROM tarifarios WHERE nombre = 'Tarifario General' AND activo = true LIMIT 1"
      );

      if (tarifarioGeneralResult.rows.length === 0) {
        throw new Error('No se encontró el Tarifario General para clientes particulares');
      }

      tarifarioId = tarifarioGeneralResult.rows[0].id;
    }

    // Obtener precios del tarifario con nombre del análisis
    for (const analisisId of analisisIds) {
      const result = await pool.query(
        `SELECT a.nombre, COALESCE(tp.precio, 0) as precio
         FROM analisis a
         LEFT JOIN tarifario_precios tp ON tp.analisis_id = a.id AND tp.tarifario_id = $1
         WHERE a.id = $2`,
        [tarifarioId, analisisId]
      );

      if (result.rows.length > 0) {
        precios.push({
          analisis_id: analisisId,
          nombre: result.rows[0].nombre,
          precio: parseFloat(result.rows[0].precio),
        });
      }
    }

    return precios;
  }

  private async calcularPrecios(
    analisisIds: number[],
    convenioId?: number
  ): Promise<Array<{ analisis_id: number; precio: number }>> {
    const precios: Array<{ analisis_id: number; precio: number }> = [];
    let tarifarioId: number | null = null;

    if (convenioId) {
      // Obtener tarifario del convenio
      const convenioResult = await pool.query(
        'SELECT tarifario_id FROM convenios WHERE id = $1',
        [convenioId]
      );

      if (convenioResult.rows.length === 0 || !convenioResult.rows[0].tarifario_id) {
        throw new Error('Convenio no tiene tarifario asignado');
      }

      tarifarioId = convenioResult.rows[0].tarifario_id;
    } else {
      // Sin convenio (Particular), usar Tarifario General
      const tarifarioGeneralResult = await pool.query(
        "SELECT id FROM tarifarios WHERE nombre = 'Tarifario General' AND activo = true LIMIT 1"
      );

      if (tarifarioGeneralResult.rows.length === 0) {
        throw new Error('No se encontró el Tarifario General para clientes particulares');
      }

      tarifarioId = tarifarioGeneralResult.rows[0].id;
    }

    // Obtener precios del tarifario
    for (const analisisId of analisisIds) {
      const precioResult = await pool.query(
        'SELECT precio FROM tarifario_precios WHERE tarifario_id = $1 AND analisis_id = $2',
        [tarifarioId, analisisId]
      );

      if (precioResult.rows.length === 0) {
        // Si no hay precio en el tarifario, usar precio 0 o lanzar error
        console.warn(`No se encontró precio para análisis ID ${analisisId} en tarifario ID ${tarifarioId}`);
        precios.push({
          analisis_id: analisisId,
          precio: 0,
        });
      } else {
        precios.push({
          analisis_id: analisisId,
          precio: parseFloat(precioResult.rows[0].precio),
        });
      }
    }

    return precios;
  }

  async getMedicos(): Promise<string[]> {
    const result = await pool.query(
      `SELECT DISTINCT medico 
       FROM ordenes 
       WHERE medico IS NOT NULL AND medico != ''
       ORDER BY medico`
    );
    return result.rows.map(row => row.medico);
  }

  // ========== ALERTAS ==========
  
  async getAlertasCounts(): Promise<{
    ordenesAprobadas: number;
    ordenesPendientesAprobar: number;
    ordenesAprobadasDetalle: Array<{
      id: number;
      numero_atencion: number;
      paciente_nombre: string;
      fecha_aprobacion: Date;
    }>;
  }> {
    // Contar órdenes con estado APROBADA (pendientes de imprimir)
    const aprobadas = await pool.query(
      `SELECT COUNT(*) as count FROM ordenes WHERE estado = 'APROBADA'`
    );
    
    // Contar órdenes con estado CON_RESULTADOS (pendientes de aprobar)
    const pendientesAprobar = await pool.query(
      `SELECT COUNT(*) as count FROM ordenes WHERE estado = 'CON_RESULTADOS'`
    );

    // Detalle de órdenes aprobadas
    const detalleAprobadas = await pool.query(`
      SELECT 
        o.id,
        o.numero_atencion,
        CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', p.apellido_materno) as paciente_nombre,
        o.fecha_aprobacion
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      WHERE o.estado = 'APROBADA'
      ORDER BY o.fecha_aprobacion DESC
      LIMIT 20
    `);

    return {
      ordenesAprobadas: parseInt(aprobadas.rows[0].count),
      ordenesPendientesAprobar: parseInt(pendientesAprobar.rows[0].count),
      ordenesAprobadasDetalle: detalleAprobadas.rows,
    };
  }

  async marcarComoImpreso(ordenId: number): Promise<Orden | null> {
    const result = await pool.query(
      `UPDATE ordenes 
       SET estado = 'IMPRESO', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND estado = 'APROBADA'
       RETURNING *`,
      [ordenId]
    );
    const orden = result.rows[0] || null;
    if (orden) {
      emitEvent('orden:estado_cambiado', { orden });
      emitEvent('dashboard:update');
    }
    return orden;
  }

  /**
   * Helper privado para generar condiciones pre-analíticas con IA
   */
  private async generarCondicionesPreanaliticasIA(
    ordenId: number,
    paciente: { fecha_nacimiento?: string | Date; genero?: string },
    analisisInput: { id: number }[]
  ): Promise<string> {
    try {
      const analisisIds = analisisInput.map(a => a.id);
      if (analisisIds.length === 0) return '';

      const resAnalisis = await pool.query(
        `SELECT nombre FROM analisis WHERE id = ANY($1::int[])`,
        [analisisIds]
      );

      const analisisNombres = resAnalisis.rows.map((r: any) => r.nombre);

      let edadPaciente = 0;
      if (paciente.fecha_nacimiento) {
        const fechaNac = new Date(paciente.fecha_nacimiento);
        const hoy = new Date();
        edadPaciente = hoy.getFullYear() - fechaNac.getFullYear();
        const m = hoy.getMonth() - fechaNac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
          edadPaciente--;
        }
      }

      return await iaService.procesarCondicionesPreanaliticas(ordenId, {
        paciente_genero: paciente.genero || 'M',
        paciente_edad: edadPaciente > 0 ? edadPaciente : 30,
        analisis_nombres: analisisNombres,
      });
    } catch (error) {
      console.error(`Error en generarCondicionesPreanaliticasIA para orden ${ordenId}:`, error);
      return '';
    }
  }

  /**
   * Obtiene las condiciones pre-analíticas de la orden, o las genera con IA si aún no existen
   */
  async obtenerOCrearPreanalitica(ordenId: number): Promise<string> {
    const ordenRes = await pool.query(
      `SELECT o.condiciones_preanaliticas, p.fecha_nacimiento, p.genero
       FROM ordenes o 
       INNER JOIN pacientes p ON o.paciente_id = p.id 
       WHERE o.id = $1`,
      [ordenId]
    );

    if (ordenRes.rows.length === 0) {
      throw new Error('La orden no existe');
    }

    const row = ordenRes.rows[0];
    if (row.condiciones_preanaliticas) {
      return row.condiciones_preanaliticas;
    }

    // Obtener análisis de la orden
    const analisisRes = await pool.query(
      `SELECT analisis_id FROM orden_analisis WHERE orden_id = $1`,
      [ordenId]
    );

    const analisisInput = analisisRes.rows.map((r: any) => ({ id: r.analisis_id }));

    return await this.generarCondicionesPreanaliticasIA(ordenId, row, analisisInput);
  }
}

export const ordenesService = new OrdenesService();
