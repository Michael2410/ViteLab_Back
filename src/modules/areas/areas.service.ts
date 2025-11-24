import { pool } from '../../config/database';
import type { Area, CreateAreaInput, UpdateAreaInput } from './areas.types';

export class AreasService {
  async getAll(): Promise<Area[]> {
    const result = await pool.query(
      'SELECT * FROM areas ORDER BY nombre ASC'
    );
    return result.rows;
  }

  async getById(id: number): Promise<Area | null> {
    const result = await pool.query(
      'SELECT * FROM areas WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data: CreateAreaInput): Promise<Area> {
    const result = await pool.query(
      'INSERT INTO areas (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [data.nombre, data.descripcion]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateAreaInput): Promise<Area | null> {
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

    if (fields.length === 0) {
      return this.getById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE areas SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM areas WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  async getActive(): Promise<Area[]> {
    const result = await pool.query(
      'SELECT * FROM areas WHERE activo = true ORDER BY nombre ASC'
    );
    return result.rows;
  }
}

export const areasService = new AreasService();
