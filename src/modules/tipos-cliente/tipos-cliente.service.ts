import { pool } from '../../config/database';
import type { TipoCliente, CreateTipoClienteInput, UpdateTipoClienteInput } from './tipos-cliente.types';

export class TiposClienteService {
  async getAll(): Promise<TipoCliente[]> {
    const result = await pool.query('SELECT * FROM tipos_cliente ORDER BY nombre ASC');
    return result.rows;
  }

  async getById(id: number): Promise<TipoCliente | null> {
    const result = await pool.query('SELECT * FROM tipos_cliente WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(data: CreateTipoClienteInput): Promise<TipoCliente> {
    const result = await pool.query(
      'INSERT INTO tipos_cliente (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [data.nombre, data.descripcion]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateTipoClienteInput): Promise<TipoCliente | null> {
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
      `UPDATE tipos_cliente SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM tipos_cliente WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }

  async getActive(): Promise<TipoCliente[]> {
    const result = await pool.query('SELECT * FROM tipos_cliente WHERE activo = true ORDER BY nombre ASC');
    return result.rows;
  }
}

export const tiposClienteService = new TiposClienteService();
