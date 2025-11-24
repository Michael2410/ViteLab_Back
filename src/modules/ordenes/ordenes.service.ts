import { pool } from '../../config/database';
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
    const result = await pool.query(
      `INSERT INTO pacientes (dni, nombres, apellidos, fecha_nacimiento, sexo, telefono, email, direccion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.dni,
        data.nombres,
        data.apellidos,
        data.fecha_nacimiento,
        data.sexo,
        data.telefono,
        data.email,
        data.direccion,
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
        const pacienteResult = await client.query(
          `INSERT INTO pacientes (dni, nombres, apellidos, fecha_nacimiento, sexo, telefono, email, direccion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [
            data.paciente.dni,
            data.paciente.nombres,
            data.paciente.apellidos,
            data.paciente.fecha_nacimiento,
            data.paciente.sexo,
            data.paciente.telefono,
            data.paciente.email,
            data.paciente.direccion,
          ]
        );
        paciente = pacienteResult.rows[0] as Paciente;
      }

      if (!paciente) {
        throw new Error('Error al crear o recuperar paciente');
      }

      // 2. Generar número de orden único
      const numeroOrden = await this.generateNumeroOrden();

      // 3. Obtener precios de análisis según convenio/tarifario
      const precios = await this.calcularPrecios(data.analisis_ids, data.convenio_id);
      const total = precios.reduce((sum, p) => sum + p.precio, 0);

      // 4. Crear orden
      const ordenResult = await client.query(
        `INSERT INTO ordenes (
          numero_orden, paciente_id, sede_id, tipo_cliente_id, convenio_id,
          estado, total, observaciones, usuario_registro_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          numeroOrden,
          paciente.id,
          data.sede_id,
          data.tipo_cliente_id,
          data.convenio_id,
          'REGISTRADA',
          total,
          data.observaciones,
          usuarioId,
        ]
      );
      const orden = ordenResult.rows[0];

      // 5. Crear orden_analisis con precios
      for (const precio of precios) {
        await client.query(
          'INSERT INTO orden_analisis (orden_id, analisis_id, precio) VALUES ($1, $2, $3)',
          [orden.id, precio.analisis_id, precio.precio]
        );
      }

      await client.query('COMMIT');

      // 6. Obtener orden completa con detalles
      return await this.getOrdenById(orden.id);

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
        o.*,
        json_build_object(
          'id', p.id,
          'dni', p.dni,
          'nombres', p.nombres,
          'apellidos', p.apellidos,
          'fecha_nacimiento', p.fecha_nacimiento,
          'sexo', p.sexo,
          'telefono', p.telefono,
          'email', p.email
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
            'nombre', c.nombre,
            'tarifario_id', c.tarifario_id
          )
        ELSE NULL END as convenio,
        json_build_object(
          'id', ur.id,
          'nombre', ur.nombre,
          'apellido', ur.apellido
        ) as usuario_registro,
        CASE WHEN o.usuario_resultados_id IS NOT NULL THEN
          json_build_object(
            'id', ures.id,
            'nombre', ures.nombre,
            'apellido', ures.apellido
          )
        ELSE NULL END as usuario_resultados,
        CASE WHEN o.usuario_aprobacion_id IS NOT NULL THEN
          json_build_object(
            'id', uapro.id,
            'nombre', uapro.nombre,
            'apellido', uapro.apellido
          )
        ELSE NULL END as usuario_aprobacion
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      INNER JOIN tipos_cliente tc ON o.tipo_cliente_id = tc.id
      LEFT JOIN convenios c ON o.convenio_id = c.id
      INNER JOIN usuarios ur ON o.usuario_registro_id = ur.id
      LEFT JOIN usuarios ures ON o.usuario_resultados_id = ures.id
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
        a.codigo,
        a.nombre,
        oa.precio
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
    if (filters.numero_orden) {
      conditions.push(`o.numero_orden LIKE $${paramCount++}`);
      values.push(`%${filters.numero_orden}%`);
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
        o.fecha_registro,
        o.nota,
        o.usuario_registro_id,
        o.created_at,
        o.updated_at,
        p.dni as paciente_dni,
        p.nombres as paciente_nombres,
        CONCAT(p.apellido_paterno, ' ', p.apellido_materno) as paciente_apellidos,
        s.nombre as sede_nombre,
        tc.nombre as tipo_cliente_nombre,
        c.nombre_empresa as convenio_nombre,
        COALESCE(SUM(oa.precio), 0) as total
      FROM ordenes o
      INNER JOIN pacientes p ON o.paciente_id = p.id
      INNER JOIN sedes s ON o.sede_id = s.id
      INNER JOIN tipos_cliente tc ON o.tipo_cliente_id = tc.id
      LEFT JOIN convenios c ON o.convenio_id = c.id
      LEFT JOIN orden_analisis oa ON o.id = oa.orden_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY o.id, p.dni, p.nombres, p.apellido_paterno, p.apellido_materno, s.nombre, tc.nombre, c.nombre_empresa
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
      fecha_registro: row.fecha_registro,
      total: parseFloat(row.total || 0),
      nota: row.nota,
      usuario_registro_id: row.usuario_registro_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Campos adicionales para la vista
      paciente_dni: row.paciente_dni,
      paciente_nombres: row.paciente_nombres,
      paciente_apellidos: row.paciente_apellidos,
      sede_nombre: row.sede_nombre,
      tipo_cliente_nombre: row.tipo_cliente_nombre,
      convenio_nombre: row.convenio_nombre,
    }));

    return {
      items,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOrden(id: number, data: UpdateOrdenInput): Promise<Orden> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.sede_id !== undefined) {
      fields.push(`sede_id = $${paramCount++}`);
      values.push(data.sede_id);
    }
    if (data.tipo_cliente_id !== undefined) {
      fields.push(`tipo_cliente_id = $${paramCount++}`);
      values.push(data.tipo_cliente_id);
    }
    if (data.convenio_id !== undefined) {
      fields.push(`convenio_id = $${paramCount++}`);
      values.push(data.convenio_id);
    }
    if (data.observaciones !== undefined) {
      fields.push(`observaciones = $${paramCount++}`);
      values.push(data.observaciones);
    }

    if (fields.length === 0) {
      const orden = await pool.query('SELECT * FROM ordenes WHERE id = $1', [id]);
      return orden.rows[0];
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE ordenes SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  async updateEstadoOrden(
    id: number,
    estado: EstadoOrden,
    usuarioId: number
  ): Promise<Orden> {
    let updateFields = 'estado = $1, updated_at = CURRENT_TIMESTAMP';
    const values: any[] = [estado];

    if (estado === 'CON_RESULTADOS') {
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

    return result.rows[0];
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
      return result.rows.length > 0;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ========== HELPERS ==========

  private async generateNumeroOrden(): Promise<string> {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    
    // Obtener el último número de orden del mes actual
    const result = await pool.query(
      `SELECT numero_orden FROM ordenes 
       WHERE numero_orden LIKE $1 
       ORDER BY numero_orden DESC 
       LIMIT 1`,
      [`${year}${month}%`]
    );

    let secuencia = 1;
    if (result.rows.length > 0) {
      const ultimoNumero = result.rows[0].numero_orden;
      secuencia = parseInt(ultimoNumero.slice(-5)) + 1;
    }

    return `${year}${month}${String(secuencia).padStart(5, '0')}`;
  }

  private async calcularPrecios(
    analisisIds: number[],
    convenioId?: number
  ): Promise<Array<{ analisis_id: number; precio: number }>> {
    const precios: Array<{ analisis_id: number; precio: number }> = [];

    if (convenioId) {
      // Obtener tarifario del convenio
      const convenioResult = await pool.query(
        'SELECT tarifario_id FROM convenios WHERE id = $1',
        [convenioId]
      );

      if (convenioResult.rows.length === 0 || !convenioResult.rows[0].tarifario_id) {
        throw new Error('Convenio no tiene tarifario asignado');
      }

      const tarifarioId = convenioResult.rows[0].tarifario_id;

      // Obtener precios del tarifario
      for (const analisisId of analisisIds) {
        const precioResult = await pool.query(
          'SELECT precio FROM tarifario_precios WHERE tarifario_id = $1 AND analisis_id = $2',
          [tarifarioId, analisisId]
        );

        if (precioResult.rows.length === 0) {
          throw new Error(`No se encontró precio para el análisis ID ${analisisId} en el tarifario`);
        }

        precios.push({
          analisis_id: analisisId,
          precio: parseFloat(precioResult.rows[0].precio),
        });
      }
    } else {
      // Sin convenio, precio por defecto (se puede definir un tarifario base)
      for (const analisisId of analisisIds) {
        precios.push({
          analisis_id: analisisId,
          precio: 0, // Definir lógica de precio base
        });
      }
    }

    return precios;
  }
}

export const ordenesService = new OrdenesService();
