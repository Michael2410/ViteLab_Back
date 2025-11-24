import { pool } from '../../config/database';
import type { Metodo, CreateMetodoInput, UpdateMetodoInput } from './metodos.types';

export class MetodosService {
  async getAll(): Promise<Metodo[]> {
    const result = await pool.query('SELECT * FROM metodos ORDER BY nombre ASC');
    return result.rows;
  }

  async getById(id: number): Promise<Metodo | null> {
    const result = await pool.query('SELECT * FROM metodos WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(data: CreateMetodoInput): Promise<Metodo> {
    const result = await pool.query(
      'INSERT INTO metodos (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [data.nombre, data.descripcion]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateMetodoInput): Promise<Metodo | null> {
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
      `UPDATE metodos SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM metodos WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }

  async getActive(): Promise<Metodo[]> {
    const result = await pool.query('SELECT * FROM metodos WHERE activo = true ORDER BY nombre ASC');
    return result.rows;
  }
}

export const metodosService = new MetodosService();
