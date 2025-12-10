import { pool } from '../../config/database';
import type { Analisis, CreateAnalisisInput, UpdateAnalisisInput, AnalisisWithComponents } from './analisis.types';

export class AnalisisService {
  async getAll(): Promise<Analisis[]> {
    const result = await pool.query('SELECT * FROM analisis ORDER BY nombre ASC');
    return result.rows;
  }

  async getById(id: number): Promise<Analisis | null> {
    const result = await pool.query('SELECT * FROM analisis WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getByIdWithComponents(id: number): Promise<AnalisisWithComponents | null> {
    const result = await pool.query(`
      SELECT 
        a.id,
        a.nombre,
        a.descripcion,
        a.sinonimia,
        a.componentes_ids,
        a.activo,
        a.created_at,
        a.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'nombre', c.nombre,
              'valores_referenciales', c.valores_referenciales,
              'unidad_medida', c.unidad_medida,
              'area_id', c.area_id,
              'metodo_id', c.metodo_id,
              'activo', c.activo,
              'area', CASE 
                WHEN c.area_id IS NOT NULL THEN jsonb_build_object('id', ar.id, 'nombre', ar.nombre)
                ELSE NULL 
              END,
              'metodo', CASE 
                WHEN c.metodo_id IS NOT NULL THEN jsonb_build_object('id', m.id, 'nombre', m.nombre)
                ELSE NULL 
              END
            ) ORDER BY 
              array_position(a.componentes_ids, c.id),
              c.nombre
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) as componentes
      FROM analisis a
      LEFT JOIN LATERAL unnest(a.componentes_ids) AS comp_id ON true
      LEFT JOIN componentes c ON c.id = comp_id AND c.activo = true
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN metodos m ON c.metodo_id = m.id
      WHERE a.id = $1
      GROUP BY a.id
    `, [id]);

    if (result.rows.length === 0) return null;

    return result.rows[0];
  }

  async create(data: CreateAnalisisInput): Promise<Analisis> {
    const result = await pool.query(
      'INSERT INTO analisis (nombre, descripcion, sinonimia, componentes_ids) VALUES ($1, $2, $3, $4) RETURNING *',
      [
        data.nombre, 
        data.descripcion || null, 
        data.sinonimia || [],
        data.componentes_ids || []
      ]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateAnalisisInput): Promise<Analisis | null> {
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
    if (data.sinonimia !== undefined) {
      fields.push(`sinonimia = $${paramCount++}`);
      values.push(data.sinonimia);
    }
    if (data.componentes_ids !== undefined) {
      fields.push(`componentes_ids = $${paramCount++}`);
      values.push(data.componentes_ids);
    }
    if (data.activo !== undefined) {
      fields.push(`activo = $${paramCount++}`);
      values.push(data.activo);
    }

    if (fields.length === 0) return this.getById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await pool.query(
      `UPDATE analisis SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM analisis WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }

  async getActive(): Promise<Analisis[]> {
    const result = await pool.query('SELECT * FROM analisis WHERE activo = true ORDER BY nombre ASC');
    return result.rows;
  }

  async search(query: string): Promise<any[]> {
    const result = await pool.query(`
      SELECT 
        a.id,
        a.nombre,
        a.descripcion,
        a.sinonimia,
        a.componentes_ids,
        a.activo,
        a.created_at,
        a.updated_at
      FROM analisis a
      WHERE a.activo = true 
      AND (
        LOWER(a.nombre) LIKE LOWER($1) 
        OR LOWER(a.descripcion) LIKE LOWER($1)
        OR EXISTS (
          SELECT 1 FROM unnest(a.sinonimia) AS s WHERE LOWER(s) LIKE LOWER($1)
        )
      )
      ORDER BY a.nombre ASC
      LIMIT 20
    `, [`%${query}%`]);

    // Para cada análisis, obtener sus componentes con muestras
    const analisisConComponentes = await Promise.all(
      result.rows.map(async (analisis) => {
        if (analisis.componentes_ids && analisis.componentes_ids.length > 0) {
          const componentesResult = await pool.query(`
            SELECT 
              c.id,
              c.nombre,
              c.unidad_medida,
              c.valores_referenciales,
              COALESCE(
                (SELECT json_agg(json_build_object('id', mu.id, 'nombre', mu.nombre))
                 FROM componente_muestras cm 
                 INNER JOIN muestras mu ON cm.muestra_id = mu.id 
                 WHERE cm.componente_id = c.id AND mu.activo = true), '[]'::json
              ) as muestras
            FROM componentes c
            WHERE c.id = ANY($1) AND c.activo = true
            ORDER BY array_position($1, c.id)
          `, [analisis.componentes_ids]);
          
          analisis.componentes = componentesResult.rows;
        } else {
          analisis.componentes = [];
        }
        return analisis;
      })
    );

    return analisisConComponentes;
  }
}

export const analisisService = new AnalisisService();
