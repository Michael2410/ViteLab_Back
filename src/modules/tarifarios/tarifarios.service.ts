import { pool } from '../../config/database';
import type {
  Tarifario,
  CreateTarifarioInput,
  UpdateTarifarioInput,
  TarifarioWithPrecios,
  TarifarioPrecio,
  CreateTarifarioPrecioInput,
  UpdateTarifarioPrecioInput,
} from './tarifarios.types';

export class TarifariosService {
  // TARIFARIOS
  async getAll(): Promise<Tarifario[]> {
    const result = await pool.query('SELECT * FROM tarifarios ORDER BY nombre ASC');
    return result.rows;
  }

  async getById(id: number): Promise<Tarifario | null> {
    const result = await pool.query('SELECT * FROM tarifarios WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getByIdWithPrecios(id: number): Promise<TarifarioWithPrecios | null> {
    const tarifarioResult = await pool.query('SELECT * FROM tarifarios WHERE id = $1', [id]);
    
    if (tarifarioResult.rows.length === 0) return null;

    const preciosResult = await pool.query(`
      SELECT 
        tp.id,
        tp.analisis_id,
        a.nombre as analisis_nombre,
        a.codigo as analisis_codigo,
        tp.precio
      FROM tarifario_precios tp
      INNER JOIN analisis a ON tp.analisis_id = a.id
      WHERE tp.tarifario_id = $1
      ORDER BY a.nombre
    `, [id]);

    return {
      ...tarifarioResult.rows[0],
      precios: preciosResult.rows,
    };
  }

  async create(data: CreateTarifarioInput): Promise<Tarifario> {
    const result = await pool.query(
      'INSERT INTO tarifarios (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [data.nombre, data.descripcion]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateTarifarioInput): Promise<Tarifario | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.nombre !== undefined) {
      fields.push(`nombre = $${paramCount++}`);
      values.push(data.nombre);
    }
    if (data.descripcion !== undefined) {
      fields.push(`descripcion = $${paramCount++}`);
      values.push(data.descripcion);
    }
    if (data.activo !== undefined) {
      fields.push(`activo = $${paramCount++}`);
      values.push(data.activo);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE tarifarios SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM tarifarios WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }

  async getActive(): Promise<Tarifario[]> {
    const result = await pool.query('SELECT * FROM tarifarios WHERE activo = true ORDER BY nombre ASC');
    return result.rows;
  }

  // PRECIOS
  async createPrecio(data: CreateTarifarioPrecioInput): Promise<TarifarioPrecio> {
    const result = await pool.query(
      'INSERT INTO tarifario_precios (tarifario_id, analisis_id, precio) VALUES ($1, $2, $3) RETURNING *',
      [data.tarifario_id, data.analisis_id, data.precio]
    );
    return result.rows[0];
  }

  async updatePrecio(id: number, data: UpdateTarifarioPrecioInput): Promise<TarifarioPrecio | null> {
    const result = await pool.query(
      'UPDATE tarifario_precios SET precio = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [data.precio, id]
    );
    return result.rows[0] || null;
  }

  async deletePrecio(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM tarifario_precios WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }

  async getPrecioByTarifarioAndAnalisis(tarifarioId: number, analisisId: number): Promise<TarifarioPrecio | null> {
    const result = await pool.query(
      'SELECT * FROM tarifario_precios WHERE tarifario_id = $1 AND analisis_id = $2',
      [tarifarioId, analisisId]
    );
    return result.rows[0] || null;
  }
}

export const tarifariosService = new TarifariosService();
