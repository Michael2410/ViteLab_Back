import { pool } from '../../config/database';
import type { Muestra, CreateMuestraInput, UpdateMuestraInput } from './muestras.types';

export class MuestrasService {
  async getAll(): Promise<Muestra[]> {
    const result = await pool.query('SELECT * FROM muestras ORDER BY nombre ASC');
    return result.rows;
  }

  async getById(id: number): Promise<Muestra | null> {
    const result = await pool.query('SELECT * FROM muestras WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getActive(): Promise<Muestra[]> {
    const result = await pool.query('SELECT * FROM muestras WHERE activo = true ORDER BY nombre ASC');
    return result.rows;
  }

  async create(data: CreateMuestraInput): Promise<Muestra> {
    const result = await pool.query(
      'INSERT INTO muestras (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [data.nombre, data.descripcion || null]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateMuestraInput): Promise<Muestra | null> {
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
      `UPDATE muestras SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM muestras WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }
}

export const muestrasService = new MuestrasService();
