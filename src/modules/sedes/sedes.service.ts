import { pool } from '../../config/database';
import type { Sede, CreateSedeInput, UpdateSedeInput } from './sedes.types';

export class SedesService {
  async getAll(): Promise<Sede[]> {
    const result = await pool.query('SELECT * FROM sedes ORDER BY nombre ASC');
    return result.rows;
  }

  async getById(id: number): Promise<Sede | null> {
    const result = await pool.query('SELECT * FROM sedes WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(data: CreateSedeInput): Promise<Sede> {
    const result = await pool.query(
      'INSERT INTO sedes (nombre, direccion, telefono) VALUES ($1, $2, $3) RETURNING *',
      [data.nombre, data.direccion || null, data.telefono || null]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateSedeInput): Promise<Sede | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.nombre !== undefined) {
      fields.push(`nombre = $${paramCount++}`);
      values.push(data.nombre);
    }
    if (data.direccion !== undefined) {
      fields.push(`direccion = $${paramCount++}`);
      values.push(data.direccion);
    }
    if (data.telefono !== undefined) {
      fields.push(`telefono = $${paramCount++}`);
      values.push(data.telefono);
    }
    if (data.activo !== undefined) {
      fields.push(`activo = $${paramCount++}`);
      values.push(data.activo);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE sedes SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM sedes WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }

  async getActive(): Promise<Sede[]> {
    const result = await pool.query('SELECT * FROM sedes WHERE activo = true ORDER BY nombre ASC');
    return result.rows;
  }
}

export const sedesService = new SedesService();
