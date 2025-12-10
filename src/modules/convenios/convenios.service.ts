import { pool } from '../../config/database';
import type { Convenio, CreateConvenioInput, UpdateConvenioInput, ConvenioWithTarifario } from './convenios.types';

export class ConveniosService {
  async getAll(): Promise<ConvenioWithTarifario[]> {
    const result = await pool.query(`
      SELECT 
        c.*,
        jsonb_build_object('id', t.id, 'nombre', t.nombre) as tarifario
      FROM convenios c
      LEFT JOIN tarifarios t ON c.tarifario_id = t.id
      ORDER BY c.nombre_empresa ASC
    `);
    return result.rows;
  }

  async getById(id: number): Promise<ConvenioWithTarifario | null> {
    const result = await pool.query(`
      SELECT 
        c.*,
        jsonb_build_object('id', t.id, 'nombre', t.nombre) as tarifario
      FROM convenios c
      LEFT JOIN tarifarios t ON c.tarifario_id = t.id
      WHERE c.id = $1
    `, [id]);
    return result.rows[0] || null;
  }

  async create(data: CreateConvenioInput): Promise<Convenio> {
    const result = await pool.query(
      'INSERT INTO convenios (nombre_empresa, ruc, direccion, telefono, email, tarifario_id, logo_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [data.nombre_empresa, data.ruc, data.direccion, data.telefono, data.email, data.tarifario_id, data.logo_url]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateConvenioInput): Promise<Convenio | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.nombre_empresa !== undefined) {
      fields.push(`nombre_empresa = $${paramCount++}`);
      values.push(data.nombre_empresa);
    }
    if (data.ruc !== undefined) {
      fields.push(`ruc = $${paramCount++}`);
      values.push(data.ruc);
    }
    if (data.direccion !== undefined) {
      fields.push(`direccion = $${paramCount++}`);
      values.push(data.direccion);
    }
    if (data.telefono !== undefined) {
      fields.push(`telefono = $${paramCount++}`);
      values.push(data.telefono);
    }
    if (data.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(data.email);
    }
    if (data.tarifario_id !== undefined) {
      fields.push(`tarifario_id = $${paramCount++}`);
      values.push(data.tarifario_id);
    }
    if (data.logo_url !== undefined) {
      fields.push(`logo_url = $${paramCount++}`);
      values.push(data.logo_url);
    }
    if (data.activo !== undefined) {
      fields.push(`activo = $${paramCount++}`);
      values.push(data.activo);
    }

    if (fields.length === 0) {
      const conv = await pool.query('SELECT * FROM convenios WHERE id = $1', [id]);
      return conv.rows[0] || null;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE convenios SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM convenios WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }

  async getActive(): Promise<ConvenioWithTarifario[]> {
    const result = await pool.query(`
      SELECT 
        c.*,
        jsonb_build_object('id', t.id, 'nombre', t.nombre) as tarifario
      FROM convenios c
      LEFT JOIN tarifarios t ON c.tarifario_id = t.id
      WHERE c.activo = true
      ORDER BY c.nombre_empresa ASC
    `);
    return result.rows;
  }
}

export const conveniosService = new ConveniosService();
