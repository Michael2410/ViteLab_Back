import pool from '../../config/database';
import {
  Rol,
  Permiso,
  PermisoAgrupado,
  RolConPermisos,
  CreateRolRequest,
  UpdateRolRequest,
} from './roles.types';

export class RolesService {
  // ============================================
  // ROLES
  // ============================================

  /**
   * Obtener todos los roles con conteo de usuarios
   */
  async getAll(): Promise<RolConPermisos[]> {
    const query = `
      SELECT 
        r.id, r.nombre, r.descripcion, r.activo, r.created_at, r.updated_at,
        COALESCE(
          (SELECT COUNT(*) FROM usuarios WHERE rol_id = r.id AND activo = true),
          0
        )::int as total_usuarios,
        COALESCE(
          (SELECT array_agg(p.codigo) 
           FROM roles_permisos rp 
           INNER JOIN permisos p ON rp.permiso_id = p.id 
           WHERE rp.rol_id = r.id),
          '{}'
        ) as permisos
      FROM roles r
      ORDER BY r.id ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Obtener roles activos (para selects)
   */
  async getActive(): Promise<Rol[]> {
    const query = `
      SELECT id, nombre, descripcion, activo, created_at, updated_at
      FROM roles
      WHERE activo = true
      ORDER BY nombre ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Obtener rol por ID con permisos
   */
  async getById(id: number): Promise<RolConPermisos> {
    const query = `
      SELECT 
        r.id, r.nombre, r.descripcion, r.activo, r.created_at, r.updated_at,
        COALESCE(
          (SELECT COUNT(*) FROM usuarios WHERE rol_id = r.id AND activo = true),
          0
        )::int as total_usuarios,
        COALESCE(
          (SELECT array_agg(p.codigo) 
           FROM roles_permisos rp 
           INNER JOIN permisos p ON rp.permiso_id = p.id 
           WHERE rp.rol_id = r.id),
          '{}'
        ) as permisos
      FROM roles r
      WHERE r.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error('Rol no encontrado');
    }

    return result.rows[0];
  }

  /**
   * Crear nuevo rol
   */
  async create(data: CreateRolRequest): Promise<RolConPermisos> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que el nombre no exista
      const checkQuery = 'SELECT id FROM roles WHERE LOWER(nombre) = LOWER($1)';
      const checkResult = await client.query(checkQuery, [data.nombre]);

      if (checkResult.rows.length > 0) {
        throw new Error('Ya existe un rol con ese nombre');
      }

      // Crear el rol
      const insertQuery = `
        INSERT INTO roles (nombre, descripcion, activo)
        VALUES ($1, $2, true)
        RETURNING id, nombre, descripcion, activo, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        data.nombre,
        data.descripcion || null,
      ]);

      const newRol = result.rows[0];

      // Asignar permisos
      if (data.permisos && data.permisos.length > 0) {
        const permisosValues = data.permisos
          .map((_, index) => `($1, $${index + 2})`)
          .join(', ');

        const permisosQuery = `
          INSERT INTO roles_permisos (rol_id, permiso_id)
          VALUES ${permisosValues}
          ON CONFLICT (rol_id, permiso_id) DO NOTHING
        `;

        await client.query(permisosQuery, [newRol.id, ...data.permisos]);
      }

      await client.query('COMMIT');

      // Obtener el rol con permisos
      return this.getById(newRol.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Actualizar rol
   */
  async update(id: number, data: UpdateRolRequest): Promise<RolConPermisos> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que el rol exista
      const checkQuery = 'SELECT id, nombre FROM roles WHERE id = $1';
      const checkResult = await client.query(checkQuery, [id]);

      if (checkResult.rows.length === 0) {
        throw new Error('Rol no encontrado');
      }

      // Verificar que el nombre no exista (si se está cambiando)
      if (data.nombre && data.nombre !== checkResult.rows[0].nombre) {
        const nameCheckQuery = 'SELECT id FROM roles WHERE LOWER(nombre) = LOWER($1) AND id != $2';
        const nameCheckResult = await client.query(nameCheckQuery, [data.nombre, id]);

        if (nameCheckResult.rows.length > 0) {
          throw new Error('Ya existe un rol con ese nombre');
        }
      }

      // Construir query de actualización
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.nombre !== undefined) {
        fields.push(`nombre = $${paramIndex++}`);
        values.push(data.nombre);
      }

      if (data.descripcion !== undefined) {
        fields.push(`descripcion = $${paramIndex++}`);
        values.push(data.descripcion);
      }

      if (data.activo !== undefined) {
        fields.push(`activo = $${paramIndex++}`);
        values.push(data.activo);
      }

      if (fields.length > 0) {
        values.push(id);
        const updateQuery = `
          UPDATE roles
          SET ${fields.join(', ')}
          WHERE id = $${paramIndex}
        `;

        await client.query(updateQuery, values);
      }

      // Actualizar permisos si se proporcionaron
      if (data.permisos !== undefined) {
        // Eliminar permisos actuales
        await client.query('DELETE FROM roles_permisos WHERE rol_id = $1', [id]);

        // Insertar nuevos permisos
        if (data.permisos.length > 0) {
          const permisosValues = data.permisos
            .map((_, index) => `($1, $${index + 2})`)
            .join(', ');

          const permisosQuery = `
            INSERT INTO roles_permisos (rol_id, permiso_id)
            VALUES ${permisosValues}
            ON CONFLICT (rol_id, permiso_id) DO NOTHING
          `;

          await client.query(permisosQuery, [id, ...data.permisos]);
        }
      }

      await client.query('COMMIT');

      // Obtener el rol actualizado con permisos
      return this.getById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar rol (verificar que no tenga usuarios)
   */
  async delete(id: number): Promise<void> {
    // Verificar que el rol no sea uno de los predeterminados
    const rolQuery = await pool.query('SELECT nombre FROM roles WHERE id = $1', [id]);

    if (rolQuery.rows.length === 0) {
      throw new Error('Rol no encontrado');
    }

    const rolNombre = rolQuery.rows[0].nombre;
    if (['SUPER_ADMIN', 'ADMIN'].includes(rolNombre)) {
      throw new Error('No se pueden eliminar roles predeterminados del sistema');
    }

    // Verificar que no tenga usuarios asignados
    const usersQuery = await pool.query(
      'SELECT COUNT(*) as total FROM usuarios WHERE rol_id = $1 AND activo = true',
      [id]
    );

    if (parseInt(usersQuery.rows[0].total) > 0) {
      throw new Error('No se puede eliminar el rol porque tiene usuarios asignados');
    }

    // Eliminar permisos del rol
    await pool.query('DELETE FROM roles_permisos WHERE rol_id = $1', [id]);

    // Eliminar rol
    await pool.query('DELETE FROM roles WHERE id = $1', [id]);
  }

  // ============================================
  // PERMISOS
  // ============================================

  /**
   * Obtener todos los permisos
   */
  async getAllPermisos(): Promise<Permiso[]> {
    const query = `
      SELECT id, modulo, submodulo, accion, codigo, descripcion, created_at
      FROM permisos
      ORDER BY modulo, submodulo NULLS FIRST, accion
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Obtener permisos agrupados por módulo/submódulo
   */
  async getPermisosAgrupados(): Promise<PermisoAgrupado[]> {
    const permisos = await this.getAllPermisos();

    // Agrupar por módulo
    const modulosMap = new Map<string, Map<string | null, Permiso[]>>();

    permisos.forEach((permiso) => {
      if (!modulosMap.has(permiso.modulo)) {
        modulosMap.set(permiso.modulo, new Map());
      }

      const submodulosMap = modulosMap.get(permiso.modulo)!;
      const submoduloKey = permiso.submodulo;

      if (!submodulosMap.has(submoduloKey)) {
        submodulosMap.set(submoduloKey, []);
      }

      submodulosMap.get(submoduloKey)!.push(permiso);
    });

    // Convertir a array
    const result: PermisoAgrupado[] = [];

    modulosMap.forEach((submodulosMap, modulo) => {
      const submodulos: { nombre: string | null; permisos: Permiso[] }[] = [];

      submodulosMap.forEach((permisos, submodulo) => {
        submodulos.push({ nombre: submodulo, permisos });
      });

      result.push({ modulo, submodulos });
    });

    return result;
  }

  /**
   * Obtener permisos de un rol
   */
  async getPermisosByRol(rolId: number): Promise<number[]> {
    const query = `
      SELECT permiso_id
      FROM roles_permisos
      WHERE rol_id = $1
    `;

    const result = await pool.query(query, [rolId]);
    return result.rows.map((row) => row.permiso_id);
  }
}

export const rolesService = new RolesService();
