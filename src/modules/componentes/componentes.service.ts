import { pool } from '../../config/database';
import type { Componente, CreateComponenteInput, UpdateComponenteInput } from './componentes.types';

export class ComponentesService {
  private async getMuestrasForComponente(componenteId: number): Promise<number[]> {
    const result = await pool.query(
      `SELECT muestra_id FROM componente_muestras WHERE componente_id = $1`,
      [componenteId]
    );
    return result.rows.map(row => row.muestra_id);
  }

  private async getMuestrasDetailsForComponente(componenteId: number): Promise<Array<{id: number, nombre: string}>> {
    const result = await pool.query(
      `SELECT m.id, m.nombre 
       FROM muestras m 
       INNER JOIN componente_muestras cm ON m.id = cm.muestra_id 
       WHERE cm.componente_id = $1`,
      [componenteId]
    );
    return result.rows;
  }

  private async syncMuestras(componenteId: number, muestrasIds: number[]): Promise<void> {
    // Eliminar relaciones existentes
    await pool.query('DELETE FROM componente_muestras WHERE componente_id = $1', [componenteId]);
    
    // Insertar nuevas relaciones
    if (muestrasIds && muestrasIds.length > 0) {
      const values = muestrasIds.map((_, index) => 
        `($1, $${index + 2})`
      ).join(', ');
      
      await pool.query(
        `INSERT INTO componente_muestras (componente_id, muestra_id) VALUES ${values}`,
        [componenteId, ...muestrasIds]
      );
    }
  }

  async getAll(): Promise<any[]> {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        c.valores_referenciales,
        c.unidad_medida,
        c.area_id,
        c.metodo_id,
        c.valor_alerta_min,
        c.valor_alerta_max,
        c.activo,
        c.created_at,
        c.updated_at,
        CASE 
          WHEN c.area_id IS NOT NULL THEN jsonb_build_object('id', ar.id, 'nombre', ar.nombre)
          ELSE NULL 
        END as area,
        CASE 
          WHEN c.metodo_id IS NOT NULL THEN jsonb_build_object('id', m.id, 'nombre', m.nombre)
          ELSE NULL 
        END as metodo,
        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('id', mu.id, 'nombre', mu.nombre))
           FROM componente_muestras cm 
           INNER JOIN muestras mu ON cm.muestra_id = mu.id 
           WHERE cm.componente_id = c.id), '[]'::jsonb
        ) as muestras
      FROM componentes c
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN metodos m ON c.metodo_id = m.id
      ORDER BY c.nombre
    `);
    
    // Agregar muestras_ids
    for (const row of result.rows) {
      row.muestras_ids = row.muestras ? row.muestras.map((m: any) => m.id) : [];
    }
    
    return result.rows;
  }

  async getById(id: number): Promise<any | null> {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        c.valores_referenciales,
        c.unidad_medida,
        c.area_id,
        c.metodo_id,
        c.valor_alerta_min,
        c.valor_alerta_max,
        c.activo,
        c.created_at,
        c.updated_at,
        CASE 
          WHEN c.area_id IS NOT NULL THEN jsonb_build_object('id', ar.id, 'nombre', ar.nombre)
          ELSE NULL 
        END as area,
        CASE 
          WHEN c.metodo_id IS NOT NULL THEN jsonb_build_object('id', m.id, 'nombre', m.nombre)
          ELSE NULL 
        END as metodo
      FROM componentes c
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN metodos m ON c.metodo_id = m.id
      WHERE c.id = $1
    `, [id]);
    
    if (!result.rows[0]) return null;
    
    const componente = result.rows[0];
    componente.muestras_ids = await this.getMuestrasForComponente(id);
    componente.muestras = await this.getMuestrasDetailsForComponente(id);
    
    return componente;
  }

  async getActive(): Promise<any[]> {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        c.valores_referenciales,
        c.unidad_medida,
        c.area_id,
        c.metodo_id,
        c.valor_alerta_min,
        c.valor_alerta_max,
        c.activo,
        CASE 
          WHEN c.area_id IS NOT NULL THEN jsonb_build_object('id', ar.id, 'nombre', ar.nombre)
          ELSE NULL 
        END as area,
        CASE 
          WHEN c.metodo_id IS NOT NULL THEN jsonb_build_object('id', m.id, 'nombre', m.nombre)
          ELSE NULL 
        END as metodo,
        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('id', mu.id, 'nombre', mu.nombre))
           FROM componente_muestras cm 
           INNER JOIN muestras mu ON cm.muestra_id = mu.id 
           WHERE cm.componente_id = c.id), '[]'::jsonb
        ) as muestras
      FROM componentes c
      LEFT JOIN areas ar ON c.area_id = ar.id
      LEFT JOIN metodos m ON c.metodo_id = m.id
      WHERE c.activo = true
      ORDER BY c.nombre
    `);
    
    // Agregar muestras_ids
    for (const row of result.rows) {
      row.muestras_ids = row.muestras ? row.muestras.map((m: any) => m.id) : [];
    }
    
    return result.rows;
  }

  async create(data: CreateComponenteInput): Promise<Componente> {
    const result = await pool.query(
      `INSERT INTO componentes (nombre, valores_referenciales, unidad_medida, area_id, metodo_id, valor_alerta_min, valor_alerta_max) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.nombre, 
        data.valores_referenciales || [], 
        data.unidad_medida || null,
        data.area_id || null, 
        data.metodo_id || null,
        data.valor_alerta_min ?? null,
        data.valor_alerta_max ?? null
      ]
    );
    
    const componente = result.rows[0];
    
    // Sincronizar muestras si se proporcionaron
    if (data.muestras_ids && data.muestras_ids.length > 0) {
      await this.syncMuestras(componente.id, data.muestras_ids);
    }
    
    return componente;
  }

  async update(id: number, data: UpdateComponenteInput): Promise<Componente | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.nombre !== undefined) {
      fields.push(`nombre = $${paramCount++}`);
      values.push(data.nombre);
    }
    if (data.valores_referenciales !== undefined) {
      fields.push(`valores_referenciales = $${paramCount++}`);
      values.push(data.valores_referenciales);
    }
    if (data.unidad_medida !== undefined) {
      fields.push(`unidad_medida = $${paramCount++}`);
      values.push(data.unidad_medida);
    }
    if (data.area_id !== undefined) {
      fields.push(`area_id = $${paramCount++}`);
      values.push(data.area_id);
    }
    if (data.metodo_id !== undefined) {
      fields.push(`metodo_id = $${paramCount++}`);
      values.push(data.metodo_id);
    }
    if (data.valor_alerta_min !== undefined) {
      fields.push(`valor_alerta_min = $${paramCount++}`);
      values.push(data.valor_alerta_min);
    }
    if (data.valor_alerta_max !== undefined) {
      fields.push(`valor_alerta_max = $${paramCount++}`);
      values.push(data.valor_alerta_max);
    }
    if (data.activo !== undefined) {
      fields.push(`activo = $${paramCount++}`);
      values.push(data.activo);
    }

    // Sincronizar muestras si se proporcionaron
    if (data.muestras_ids !== undefined) {
      await this.syncMuestras(id, data.muestras_ids);
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
    // Primero eliminar relaciones con muestras
    await pool.query('DELETE FROM componente_muestras WHERE componente_id = $1', [id]);
    const result = await pool.query('DELETE FROM componentes WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  }
}

export const componentesService = new ComponentesService();
