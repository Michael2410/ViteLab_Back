import { pool } from '../../config/database';
import type { Componente, CreateComponenteInput, UpdateComponenteInput } from './componentes.types';

export class ComponentesService {
  async getAll(): Promise<any[]> {
    const result = await pool.query(`
      SELECT 
        c.*,
        jsonb_build_object('id', a.id, 'nombre', a.nombre) as analisis,
        CASE 
          WHEN c.area_id IS NOT NULL THEN jsonb_build_object('id', ar.id, 'nombre', ar.nombre)
          ELSE NULL 
        END as area,
        CASE 
          WHEN c.metodo_id IS NOT NULL THEN jsonb_build_object('id', m.id, 'nombre', m.nombre)
          ELSE NULL 
        END as metodo
      FROM componentes c
      INNER JOIN analisis a ON c.analisis_id = a.id
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN metodos m ON c.metodo_id = m.id
      ORDER BY a.nombre, c.orden, c.nombre
    `);
    return result.rows;
  }

  async getById(id: number): Promise<any | null> {
    const result = await pool.query(`
      SELECT 
        c.*,
        jsonb_build_object('id', a.id, 'nombre', a.nombre) as analisis,
        CASE 
          WHEN c.area_id IS NOT NULL THEN jsonb_build_object('id', ar.id, 'nombre', ar.nombre)
          ELSE NULL 
        END as area,
        CASE 
          WHEN c.metodo_id IS NOT NULL THEN jsonb_build_object('id', m.id, 'nombre', m.nombre)
          ELSE NULL 
        END as metodo
      FROM componentes c
      INNER JOIN analisis a ON c.analisis_id = a.id
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN metodos m ON c.metodo_id = m.id
      WHERE c.id = $1
    `, [id]);
    return result.rows[0] || null;
  }

  async getByAnalisisId(analisisId: number): Promise<any[]> {
    const result = await pool.query(`
      SELECT 
        c.*,
        jsonb_build_object('id', a.id, 'nombre', a.nombre) as analisis,
        CASE 
          WHEN c.area_id IS NOT NULL THEN jsonb_build_object('id', ar.id, 'nombre', ar.nombre)
          ELSE NULL 
        END as area,
        CASE 
          WHEN c.metodo_id IS NOT NULL THEN jsonb_build_object('id', m.id, 'nombre', m.nombre)
          ELSE NULL 
        END as metodo
      FROM componentes c
      INNER JOIN analisis a ON c.analisis_id = a.id
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN metodos m ON c.metodo_id = m.id
      WHERE c.analisis_id = $1 AND c.activo = true
      ORDER BY c.orden, c.nombre
    `, [analisisId]);
    return result.rows;
  }

  async create(data: CreateComponenteInput): Promise<Componente> {
    const result = await pool.query(
      `INSERT INTO componentes (analisis_id, nombre, valor_referencial, area_id, metodo_id, orden) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.analisis_id, data.nombre, data.valor_referencial, data.area_id, data.metodo_id, data.orden || 0]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateComponenteInput): Promise<Componente | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.analisis_id !== undefined) {
      fields.push(`analisis_id = $${paramCount++}`);
      values.push(data.analisis_id);
    }
    if (data.nombre !== undefined) {
      fields.push(`nombre = $${paramCount++}`);
      values.push(data.nombre);
    }
    if (data.valor_referencial !== undefined) {
      fields.push(`valor_referencial = $${paramCount++}`);
      values.push(data.valor_referencial);
    }
    if (data.area_id !== undefined) {
      fields.push(`area_id = $${paramCount++}`);
      values.push(data.area_id);
    }
    if (data.metodo_id !== undefined) {
      fields.push(`metodo_id = $${paramCount++}`);
      values.push(data.metodo_id);
    }
    if (data.orden !== undefined) {
      fields.push(`orden = $${paramCount++}`);
      values.push(data.orden);
    }
    if (data.activo !== undefined) {
      fields.push(`activo = $${paramCount++}`);
      values.push(data.activo);
    }

    if (fields.length === 0) {
      const comp = await pool.query('SELECT * FROM componentes WHERE id = $1', [id]);
      return comp.rows[0] || null;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE componentes SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM componentes WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }
}

export const componentesService = new ComponentesService();
