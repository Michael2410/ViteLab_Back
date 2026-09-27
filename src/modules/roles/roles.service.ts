import { eq, and, asc, count, sql } from 'drizzle-orm';
import { db, roles, permisos, rolesPermisos, usuarios } from '../../db';
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
    const allRoles = await db
      .select()
      .from(roles)
      .orderBy(asc(roles.id));

    // Conteo de usuarios por rol
    const userCounts = await db
      .select({ rol_id: usuarios.rol_id, count: count() })
      .from(usuarios)
      .where(eq(usuarios.activo, true))
      .groupBy(usuarios.rol_id);

    const userCountMap = new Map<number, number>();
    userCounts.forEach((u) => {
      if (u.rol_id !== null) {
        userCountMap.set(u.rol_id, Number(u.count));
      }
    });

    // Permisos por rol
    const rolesWithPerms = await db
      .select({
        rol_id: rolesPermisos.rol_id,
        codigo: permisos.codigo,
      })
      .from(rolesPermisos)
      .innerJoin(permisos, eq(rolesPermisos.permiso_id, permisos.id));

    const permsMap = new Map<number, string[]>();
    rolesWithPerms.forEach((rp) => {
      if (!permsMap.has(rp.rol_id)) permsMap.set(rp.rol_id, []);
      permsMap.get(rp.rol_id)!.push(rp.codigo);
    });

    return allRoles.map((r) => ({
      ...r,
      total_usuarios: userCountMap.get(r.id) || 0,
      permisos: permsMap.get(r.id) || [],
    }));
  }

  /**
   * Obtener roles activos (para selects)
   */
  async getActive(): Promise<Rol[]> {
    return db
      .select()
      .from(roles)
      .where(eq(roles.activo, true))
      .orderBy(asc(roles.nombre));
  }

  /**
   * Obtener rol por ID con permisos
   */
  async getById(id: number): Promise<RolConPermisos> {
    const [rol] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, id));

    if (!rol) {
      throw new Error('Rol no encontrado');
    }

    const [userCount] = await db
      .select({ count: count() })
      .from(usuarios)
      .where(and(eq(usuarios.rol_id, id), eq(usuarios.activo, true)));

    const perms = await db
      .select({ codigo: permisos.codigo })
      .from(rolesPermisos)
      .innerJoin(permisos, eq(rolesPermisos.permiso_id, permisos.id))
      .where(eq(rolesPermisos.rol_id, id));

    return {
      ...rol,
      total_usuarios: Number(userCount?.count || 0),
      permisos: perms.map((p) => p.codigo),
    };
  }

  /**
   * Crear nuevo rol
   */
  async create(data: CreateRolRequest): Promise<RolConPermisos> {
    const newRolId = await db.transaction(async (tx) => {
      // Verificar que el nombre no exista
      const checkResult = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(sql`LOWER(${roles.nombre}) = LOWER(${data.nombre})`);

      if (checkResult.length > 0) {
        throw new Error('Ya existe un rol con ese nombre');
      }

      // Crear el rol
      const [newRol] = await tx
        .insert(roles)
        .values({
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          activo: true,
        })
        .returning();

      // Asignar permisos
      if (data.permisos && data.permisos.length > 0) {
        await tx
          .insert(rolesPermisos)
          .values(
            data.permisos.map((permiso_id) => ({
              rol_id: newRol.id,
              permiso_id,
            }))
          )
          .onConflictDoNothing();
      }

      return newRol.id;
    });

    return this.getById(newRolId);
  }

  /**
   * Actualizar rol
   */
  async update(id: number, data: UpdateRolRequest): Promise<RolConPermisos> {
    await db.transaction(async (tx) => {
      // Verificar que el rol exista
      const [existing] = await tx
        .select({ id: roles.id, nombre: roles.nombre })
        .from(roles)
        .where(eq(roles.id, id));

      if (!existing) {
        throw new Error('Rol no encontrado');
      }

      // Verificar nombre duplicado
      if (data.nombre && data.nombre.toLowerCase() !== existing.nombre.toLowerCase()) {
        const checkResult = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(
            and(
              sql`LOWER(${roles.nombre}) = LOWER(${data.nombre})`,
              sql`${roles.id} != ${id}`
            )
          );

        if (checkResult.length > 0) {
          throw new Error('Ya existe un rol con ese nombre');
        }
      }

      // Construir actualización
      const updateData: Partial<typeof roles.$inferInsert> = {
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      };
      if (data.nombre !== undefined) updateData.nombre = data.nombre;
      if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
      if (data.activo !== undefined) updateData.activo = data.activo;

      await tx
        .update(roles)
        .set(updateData)
        .where(eq(roles.id, id));

      // Actualizar permisos si fueron enviados
      if (data.permisos !== undefined) {
        await tx.delete(rolesPermisos).where(eq(rolesPermisos.rol_id, id));

        if (data.permisos.length > 0) {
          await tx
            .insert(rolesPermisos)
            .values(
              data.permisos.map((permiso_id) => ({
                rol_id: id,
                permiso_id,
              }))
            )
            .onConflictDoNothing();
        }
      }
    });

    return this.getById(id);
  }

  /**
   * Eliminar rol (verificar que no tenga usuarios)
   */
  async delete(id: number): Promise<void> {
    const [rol] = await db
      .select({ nombre: roles.nombre })
      .from(roles)
      .where(eq(roles.id, id));

    if (!rol) {
      throw new Error('Rol no encontrado');
    }

    if (['SUPER_ADMIN', 'ADMIN'].includes(rol.nombre)) {
      throw new Error('No se pueden eliminar roles predeterminados del sistema');
    }

    const [userCount] = await db
      .select({ count: count() })
      .from(usuarios)
      .where(and(eq(usuarios.rol_id, id), eq(usuarios.activo, true)));

    if (Number(userCount?.count || 0) > 0) {
      throw new Error('No se puede eliminar el rol porque tiene usuarios asignados');
    }

    await db.transaction(async (tx) => {
      await tx.delete(rolesPermisos).where(eq(rolesPermisos.rol_id, id));
      await tx.delete(roles).where(eq(roles.id, id));
    });
  }

  // ============================================
  // PERMISOS
  // ============================================

  /**
   * Obtener todos los permisos
   */
  async getAllPermisos(): Promise<Permiso[]> {
    return db
      .select()
      .from(permisos)
      .orderBy(asc(permisos.modulo), asc(permisos.submodulo), asc(permisos.accion));
  }

  /**
   * Obtener permisos agrupados por módulo/submódulo
   */
  async getPermisosAgrupados(): Promise<PermisoAgrupado[]> {
    const allPermisos = await this.getAllPermisos();

    // Agrupar por módulo
    const modulosMap = new Map<string, Map<string | null, Permiso[]>>();

    allPermisos.forEach((permiso) => {
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

      submodulosMap.forEach((pList, submodulo) => {
        submodulos.push({ nombre: submodulo, permisos: pList });
      });

      result.push({ modulo, submodulos });
    });

    return result;
  }

  /**
   * Obtener permisos de un rol
   */
  async getPermisosByRol(rolId: number): Promise<number[]> {
    const rows = await db
      .select({ permiso_id: rolesPermisos.permiso_id })
      .from(rolesPermisos)
      .where(eq(rolesPermisos.rol_id, rolId));

    return rows.map((row) => row.permiso_id);
  }
}

export const rolesService = new RolesService();
