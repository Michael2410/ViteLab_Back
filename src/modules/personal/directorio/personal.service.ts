import bcrypt from 'bcrypt';
import { eq, and, or, asc, desc, inArray, sql } from 'drizzle-orm';
import {
  db,
  personal,
  personalCargos,
  personalAreas,
  personalTiposContrato,
  personalMotivosCese,
  personalSedes,
  sedes,
  usuarios,
  roles,
  usuariosSedes,
  personalHistorialLaboral,
} from '../../../db';
import {
  Personal,
  CreatePersonalDTO,
  UpdatePersonalDTO,
  VincularCuentaDTO,
  DarDeBajaPersonalDTO,
  UpdateCuentaPersonalDTO,
  FiltrosPersonal,
  PersonalSede,
  PersonalUsuarioInfo,
} from './personal.types';

export class PersonalService {
  /**
   * Obtener sedes asignadas a un personal
   */
  private async getPersonalSedes(personalId: number): Promise<PersonalSede[]> {
    return db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
      })
      .from(sedes)
      .innerJoin(personalSedes, eq(sedes.id, personalSedes.sede_id))
      .where(and(eq(personalSedes.personal_id, personalId), eq(sedes.activo, true)))
      .orderBy(asc(sedes.nombre));
  }

  /**
   * Obtener datos de cuenta de usuario si existe
   */
  private async getPersonalUsuario(personalId: number): Promise<PersonalUsuarioInfo | null> {
    const [user] = await db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        email: usuarios.email,
        rol_id: usuarios.rol_id,
        rol_nombre: roles.nombre,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rol_id, roles.id))
      .where(eq(usuarios.personal_id, personalId));

    return (user as any) || null;
  }

  /**
   * Sincronizar sedes entre personal_sedes y usuarios_sedes (compatibilidad)
   */
  private async syncUsuariosSedes(
    txOrDb: any,
    personalId: number,
    sedeIds: number[]
  ): Promise<void> {
    const [u] = await txOrDb
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.personal_id, personalId));

    if (u) {
      await txOrDb.delete(usuariosSedes).where(eq(usuariosSedes.usuario_id, u.id));

      if (sedeIds.length > 0) {
        await txOrDb
          .insert(usuariosSedes)
          .values(
            sedeIds.map((sede_id) => ({
              usuario_id: u.id,
              sede_id,
            }))
          )
          .onConflictDoNothing();
      }
    }
  }

  /**
   * Registrar evento en el historial laboral de auditoría
   */
  private async registrarLogLaboral(
    txOrDb: any,
    data: {
      personal_id: number;
      tipo_evento: string;
      fecha_evento: string | Date;
      cargo?: string | null;
      area?: string | null;
      tipo_contrato?: string | null;
      sueldo_base?: number | null;
      motivo_cese_id?: number | null;
      motivo_cese_texto?: string | null;
      observaciones?: string | null;
      usuario_id?: number | null;
    }
  ): Promise<void> {
    await txOrDb.insert(personalHistorialLaboral).values({
      personal_id: data.personal_id,
      tipo_evento: data.tipo_evento,
      fecha_evento: data.fecha_evento,
      cargo: data.cargo || null,
      area: data.area || null,
      tipo_contrato: data.tipo_contrato || null,
      sueldo_base: data.sueldo_base != null ? String(data.sueldo_base) : null,
      motivo_cese_id: data.motivo_cese_id || null,
      motivo_cese_texto: data.motivo_cese_texto || null,
      observaciones: data.observaciones || null,
      usuario_id: data.usuario_id || null,
    });
  }

  /**
   * Listar todo el personal con filtros
   */
  async getAllPersonal(filtros: FiltrosPersonal = {}): Promise<Personal[]> {
    const conditions = [];

    if (filtros.activo !== undefined) {
      conditions.push(eq(personal.activo, filtros.activo));
    }

    if (filtros.cargo_id) {
      conditions.push(eq(personal.cargo_id, filtros.cargo_id));
    } else if (filtros.cargo) {
      conditions.push(
        or(eq(personal.cargo, filtros.cargo), eq(personalCargos.nombre, filtros.cargo))
      );
    }

    if (filtros.area_id) {
      conditions.push(eq(personal.area_id, filtros.area_id));
    } else if (filtros.area) {
      conditions.push(
        or(eq(personal.area, filtros.area), eq(personalAreas.nombre, filtros.area))
      );
    }

    if (filtros.tipo_contrato_id) {
      conditions.push(eq(personal.tipo_contrato_id, filtros.tipo_contrato_id));
    }

    if (filtros.search) {
      const s = `%${filtros.search}%`;
      conditions.push(
        sql`(${personal.nombres} ILIKE ${s} OR ${personal.apellidos} ILIKE ${s} OR ${personal.numero_documento} ILIKE ${s} OR ${personal.email} ILIKE ${s})`
      );
    }

    if (filtros.sede_id) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM personal_sedes ps WHERE ps.personal_id = ${personal.id} AND ps.sede_id = ${filtros.sede_id})`
      );
    }

    if (filtros.con_usuario !== undefined) {
      if (filtros.con_usuario) {
        conditions.push(
          sql`EXISTS (SELECT 1 FROM usuarios u WHERE u.personal_id = ${personal.id} AND u.activo = true)`
        );
      } else {
        conditions.push(
          sql`NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.personal_id = ${personal.id} AND u.activo = true)`
        );
      }
    }

    const rows = await db
      .select({
        id: personal.id,
        tipo_documento: personal.tipo_documento,
        numero_documento: personal.numero_documento,
        nombres: personal.nombres,
        apellidos: personal.apellidos,
        cargo: sql<string>`COALESCE(${personalCargos.nombre}, ${personal.cargo})`,
        cargo_id: personal.cargo_id,
        area: sql<string>`COALESCE(${personalAreas.nombre}, ${personal.area})`,
        area_id: personal.area_id,
        email: personal.email,
        telefono: personal.telefono,
        direccion: personal.direccion,
        fecha_nacimiento: sql<string | null>`TO_CHAR(${personal.fecha_nacimiento}, 'YYYY-MM-DD')`,
        fecha_ingreso: sql<string | null>`TO_CHAR(${personal.fecha_ingreso}, 'YYYY-MM-DD')`,
        tipo_contrato: sql<string>`COALESCE(${personalTiposContrato.nombre}, ${personal.tipo_contrato})`,
        tipo_contrato_id: personal.tipo_contrato_id,
        sueldo_base: personal.sueldo_base,
        colegiatura: personal.colegiatura,
        firma_url: personal.firma_url,
        activo: personal.activo,
        fecha_cese: sql<string | null>`TO_CHAR(${personal.fecha_cese}, 'YYYY-MM-DD')`,
        motivo_cese: sql<string>`COALESCE(${personalMotivosCese.nombre}, ${personal.motivo_cese})`,
        motivo_cese_id: personal.motivo_cese_id,
        observaciones_cese: personal.observaciones_cese,
        created_at: personal.created_at,
        updated_at: personal.updated_at,
        usuario_id: usuarios.id,
        usuario_username: usuarios.username,
        usuario_email: usuarios.email,
        usuario_rol_id: usuarios.rol_id,
        usuario_rol_nombre: roles.nombre,
        usuario_activo: usuarios.activo,
      })
      .from(personal)
      .leftJoin(personalCargos, eq(personal.cargo_id, personalCargos.id))
      .leftJoin(personalAreas, eq(personal.area_id, personalAreas.id))
      .leftJoin(
        personalTiposContrato,
        eq(personal.tipo_contrato_id, personalTiposContrato.id)
      )
      .leftJoin(
        personalMotivosCese,
        eq(personal.motivo_cese_id, personalMotivosCese.id)
      )
      .leftJoin(usuarios, eq(usuarios.personal_id, personal.id))
      .leftJoin(roles, eq(usuarios.rol_id, roles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(personal.activo), asc(personal.apellidos), asc(personal.nombres));

    const pIds = rows.map((r) => r.id);
    const sedesMap = new Map<number, PersonalSede[]>();

    if (pIds.length > 0) {
      const psRows = await db
        .select({
          personal_id: personalSedes.personal_id,
          sede_id: sedes.id,
          sede_nombre: sedes.nombre,
        })
        .from(personalSedes)
        .innerJoin(sedes, eq(personalSedes.sede_id, sedes.id))
        .where(and(inArray(personalSedes.personal_id, pIds), eq(sedes.activo, true)))
        .orderBy(asc(sedes.nombre));

      psRows.forEach((ps) => {
        if (!sedesMap.has(ps.personal_id)) sedesMap.set(ps.personal_id, []);
        sedesMap.get(ps.personal_id)!.push({ id: ps.sede_id, nombre: ps.sede_nombre });
      });
    }

    return rows.map((row) => {
      let usuario: PersonalUsuarioInfo | null = null;
      if (row.usuario_id) {
        usuario = {
          id: row.usuario_id,
          username: row.usuario_username!,
          email: row.usuario_email!,
          rol_id: row.usuario_rol_id!,
          rol_nombre: row.usuario_rol_nombre!,
          activo: Boolean(row.usuario_activo),
        };
      }

      const {
        usuario_id: _,
        usuario_username: __,
        usuario_email: ___,
        usuario_rol_id: ____,
        usuario_rol_nombre: _____,
        usuario_activo: ______,
        ...personalData
      } = row;

      return {
        ...personalData,
        sedes: sedesMap.get(row.id) || [],
        usuario,
      } as any;
    });
  }

  /**
   * Obtener un colaborador por ID con sedes y cuenta de usuario
   */
  async getPersonalById(id: number): Promise<Personal> {
    const [row] = await db
      .select({
        id: personal.id,
        tipo_documento: personal.tipo_documento,
        numero_documento: personal.numero_documento,
        nombres: personal.nombres,
        apellidos: personal.apellidos,
        cargo: sql<string>`COALESCE(${personalCargos.nombre}, ${personal.cargo})`,
        cargo_id: personal.cargo_id,
        area: sql<string>`COALESCE(${personalAreas.nombre}, ${personal.area})`,
        area_id: personal.area_id,
        email: personal.email,
        telefono: personal.telefono,
        direccion: personal.direccion,
        fecha_nacimiento: sql<string | null>`TO_CHAR(${personal.fecha_nacimiento}, 'YYYY-MM-DD')`,
        fecha_ingreso: sql<string | null>`TO_CHAR(${personal.fecha_ingreso}, 'YYYY-MM-DD')`,
        tipo_contrato: sql<string>`COALESCE(${personalTiposContrato.nombre}, ${personal.tipo_contrato})`,
        tipo_contrato_id: personal.tipo_contrato_id,
        sueldo_base: personal.sueldo_base,
        colegiatura: personal.colegiatura,
        firma_url: personal.firma_url,
        activo: personal.activo,
        fecha_cese: sql<string | null>`TO_CHAR(${personal.fecha_cese}, 'YYYY-MM-DD')`,
        motivo_cese: sql<string>`COALESCE(${personalMotivosCese.nombre}, ${personal.motivo_cese})`,
        motivo_cese_id: personal.motivo_cese_id,
        observaciones_cese: personal.observaciones_cese,
        created_at: personal.created_at,
        updated_at: personal.updated_at,
      })
      .from(personal)
      .leftJoin(personalCargos, eq(personal.cargo_id, personalCargos.id))
      .leftJoin(personalAreas, eq(personal.area_id, personalAreas.id))
      .leftJoin(
        personalTiposContrato,
        eq(personal.tipo_contrato_id, personalTiposContrato.id)
      )
      .leftJoin(
        personalMotivosCese,
        eq(personal.motivo_cese_id, personalMotivosCese.id)
      )
      .where(eq(personal.id, id));

    if (!row) {
      throw new Error('Colaborador no encontrado');
    }

    const sedesList = await this.getPersonalSedes(id);
    const usuarioInfo = await this.getPersonalUsuario(id);

    return {
      ...row,
      sedes: sedesList,
      usuario: usuarioInfo,
    } as any;
  }

  /**
   * Crear un nuevo colaborador, opcionalmente con cuenta de usuario vinculada
   */
  async createPersonal(
    data: CreatePersonalDTO,
    usuarioIdResponsable?: number | null
  ): Promise<Personal> {
    const newPersonalId = await db.transaction(async (tx) => {
      // Validar documento duplicado si se proporciona
      if (data.numero_documento) {
        const docExists = await tx
          .select({ id: personal.id })
          .from(personal)
          .where(eq(personal.numero_documento, data.numero_documento));

        if (docExists.length > 0) {
          throw new Error('Ya existe un colaborador con este número de documento');
        }
      }

      // Sincronizar catálogo de cargo si se dio cargo_id o cargo texto
      let cargo = data.cargo || null;
      let cargo_id = data.cargo_id || null;
      if (cargo_id && !cargo) {
        const [cRes] = await tx
          .select({ nombre: personalCargos.nombre })
          .from(personalCargos)
          .where(eq(personalCargos.id, cargo_id));
        if (cRes) cargo = cRes.nombre;
      } else if (!cargo_id && cargo) {
        const [cRes] = await tx
          .select({ id: personalCargos.id })
          .from(personalCargos)
          .where(sql`LOWER(${personalCargos.nombre}) = LOWER(${cargo.trim()})`);
        if (cRes) cargo_id = cRes.id;
      }

      // Sincronizar catálogo de área
      let area = data.area || null;
      let area_id = data.area_id || null;
      if (area_id && !area) {
        const [aRes] = await tx
          .select({ nombre: personalAreas.nombre })
          .from(personalAreas)
          .where(eq(personalAreas.id, area_id));
        if (aRes) area = aRes.nombre;
      } else if (!area_id && area) {
        const [aRes] = await tx
          .select({ id: personalAreas.id })
          .from(personalAreas)
          .where(sql`LOWER(${personalAreas.nombre}) = LOWER(${area.trim()})`);
        if (aRes) area_id = aRes.id;
      }

      // Sincronizar tipo de contrato
      let tipo_contrato = data.tipo_contrato || null;
      let tipo_contrato_id = data.tipo_contrato_id || null;
      if (tipo_contrato_id && !tipo_contrato) {
        const [tcRes] = await tx
          .select({ nombre: personalTiposContrato.nombre })
          .from(personalTiposContrato)
          .where(eq(personalTiposContrato.id, tipo_contrato_id));
        if (tcRes) tipo_contrato = tcRes.nombre;
      } else if (!tipo_contrato_id && tipo_contrato) {
        const [tcRes] = await tx
          .select({ id: personalTiposContrato.id })
          .from(personalTiposContrato)
          .where(sql`LOWER(${personalTiposContrato.nombre}) = LOWER(${tipo_contrato.trim()})`);
        if (tcRes) tipo_contrato_id = tcRes.id;
      }

      const [newPersonal] = await tx
        .insert(personal)
        .values({
          tipo_documento: data.tipo_documento || 'DNI',
          numero_documento: data.numero_documento || null,
          nombres: data.nombres.trim(),
          apellidos: data.apellidos.trim(),
          cargo,
          cargo_id,
          area,
          area_id,
          email: data.email || null,
          telefono: data.telefono || null,
          direccion: data.direccion || null,
          fecha_nacimiento: data.fecha_nacimiento || null,
          fecha_ingreso: data.fecha_ingreso || null,
          tipo_contrato,
          tipo_contrato_id,
          sueldo_base: data.sueldo_base != null ? String(data.sueldo_base) : null,
          colegiatura: data.colegiatura || null,
          firma_url: data.firma_url || null,
        })
        .returning({ id: personal.id });

      // Asignar sedes
      if (data.sede_ids && data.sede_ids.length > 0) {
        await tx
          .insert(personalSedes)
          .values(
            data.sede_ids.map((sede_id) => ({
              personal_id: newPersonal.id,
              sede_id,
            }))
          )
          .onConflictDoNothing();
      }

      // Registrar LOG de ALTA_INICIAL
      const fechaIngreso = data.fecha_ingreso || new Date().toISOString().split('T')[0];
      await this.registrarLogLaboral(tx, {
        personal_id: newPersonal.id,
        tipo_evento: 'ALTA_INICIAL',
        fecha_evento: fechaIngreso,
        cargo,
        area,
        tipo_contrato,
        sueldo_base: data.sueldo_base,
        observaciones: 'Ingreso inicial a la organización registrado en el sistema',
        usuario_id: usuarioIdResponsable,
      });

      // Crear usuario de sistema si se solicitó
      if (data.crear_usuario && data.usuario_data) {
        const { username, email, password, rol_id } = data.usuario_data;

        const userExists = await tx
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(or(eq(usuarios.username, username), eq(usuarios.email, email)));

        if (userExists.length > 0) {
          throw new Error('El nombre de usuario o email ya está en uso');
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [newUser] = await tx
          .insert(usuarios)
          .values({
            username,
            email,
            password_hash,
            rol_id,
            personal_id: newPersonal.id,
          })
          .returning({ id: usuarios.id });

        if (data.sede_ids && data.sede_ids.length > 0) {
          await tx
            .insert(usuariosSedes)
            .values(
              data.sede_ids.map((sede_id) => ({
                usuario_id: newUser.id,
                sede_id,
              }))
            )
            .onConflictDoNothing();
        }
      }

      return newPersonal.id;
    });

    return await this.getPersonalById(newPersonalId);
  }

  /**
   * Actualizar personal
   */
  async updatePersonal(id: number, data: UpdatePersonalDTO): Promise<Personal> {
    await db.transaction(async (tx) => {
      if (data.numero_documento) {
        const docExists = await tx
          .select({ id: personal.id })
          .from(personal)
          .where(
            and(
              eq(personal.numero_documento, data.numero_documento),
              sql`${personal.id} != ${id}`
            )
          );

        if (docExists.length > 0) {
          throw new Error('Ya existe otro colaborador con este número de documento');
        }
      }

      const updateData: Partial<typeof personal.$inferInsert> = {
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      };

      if (data.tipo_documento !== undefined) updateData.tipo_documento = data.tipo_documento;
      if (data.numero_documento !== undefined) updateData.numero_documento = data.numero_documento;
      if (data.nombres !== undefined) updateData.nombres = data.nombres.trim();
      if (data.apellidos !== undefined) updateData.apellidos = data.apellidos.trim();

      // Sincronizar cargo
      if (data.cargo_id !== undefined) {
        updateData.cargo_id = data.cargo_id;
        if (data.cargo_id) {
          const [cRes] = await tx
            .select({ nombre: personalCargos.nombre })
            .from(personalCargos)
            .where(eq(personalCargos.id, data.cargo_id));
          updateData.cargo = cRes ? cRes.nombre : null;
        } else {
          updateData.cargo = null;
        }
      } else if (data.cargo !== undefined) {
        updateData.cargo = data.cargo;
        if (data.cargo) {
          const [cRes] = await tx
            .select({ id: personalCargos.id })
            .from(personalCargos)
            .where(sql`LOWER(${personalCargos.nombre}) = LOWER(${data.cargo.trim()})`);
          updateData.cargo_id = cRes ? cRes.id : null;
        } else {
          updateData.cargo_id = null;
        }
      }

      // Sincronizar área
      if (data.area_id !== undefined) {
        updateData.area_id = data.area_id;
        if (data.area_id) {
          const [aRes] = await tx
            .select({ nombre: personalAreas.nombre })
            .from(personalAreas)
            .where(eq(personalAreas.id, data.area_id));
          updateData.area = aRes ? aRes.nombre : null;
        } else {
          updateData.area = null;
        }
      } else if (data.area !== undefined) {
        updateData.area = data.area;
        if (data.area) {
          const [aRes] = await tx
            .select({ id: personalAreas.id })
            .from(personalAreas)
            .where(sql`LOWER(${personalAreas.nombre}) = LOWER(${data.area.trim()})`);
          updateData.area_id = aRes ? aRes.id : null;
        } else {
          updateData.area_id = null;
        }
      }

      // Sincronizar tipo de contrato
      if (data.tipo_contrato_id !== undefined) {
        updateData.tipo_contrato_id = data.tipo_contrato_id;
        if (data.tipo_contrato_id) {
          const [tcRes] = await tx
            .select({ nombre: personalTiposContrato.nombre })
            .from(personalTiposContrato)
            .where(eq(personalTiposContrato.id, data.tipo_contrato_id));
          updateData.tipo_contrato = tcRes ? tcRes.nombre : null;
        } else {
          updateData.tipo_contrato = null;
        }
      } else if (data.tipo_contrato !== undefined) {
        updateData.tipo_contrato = data.tipo_contrato;
        if (data.tipo_contrato) {
          const [tcRes] = await tx
            .select({ id: personalTiposContrato.id })
            .from(personalTiposContrato)
            .where(
              sql`LOWER(${personalTiposContrato.nombre}) = LOWER(${data.tipo_contrato.trim()})`
            );
          updateData.tipo_contrato_id = tcRes ? tcRes.id : null;
        } else {
          updateData.tipo_contrato_id = null;
        }
      }

      if (data.email !== undefined) updateData.email = data.email;
      if (data.telefono !== undefined) updateData.telefono = data.telefono;
      if (data.direccion !== undefined) updateData.direccion = data.direccion;
      if (data.fecha_nacimiento !== undefined) updateData.fecha_nacimiento = data.fecha_nacimiento;
      if (data.fecha_ingreso !== undefined) updateData.fecha_ingreso = data.fecha_ingreso;
      if (data.sueldo_base !== undefined) {
        updateData.sueldo_base = data.sueldo_base != null ? String(data.sueldo_base) : null;
      }
      if (data.colegiatura !== undefined) updateData.colegiatura = data.colegiatura;
      if (data.firma_url !== undefined) updateData.firma_url = data.firma_url;
      if (data.activo !== undefined) updateData.activo = data.activo;
      if (data.fecha_cese !== undefined) updateData.fecha_cese = data.fecha_cese;
      if (data.motivo_cese !== undefined) updateData.motivo_cese = data.motivo_cese;
      if (data.motivo_cese_id !== undefined) updateData.motivo_cese_id = data.motivo_cese_id;
      if (data.observaciones_cese !== undefined) updateData.observaciones_cese = data.observaciones_cese;

      await tx
        .update(personal)
        .set(updateData)
        .where(eq(personal.id, id));

      // Actualizar sedes si se proporcionaron
      if (data.sede_ids !== undefined) {
        await tx.delete(personalSedes).where(eq(personalSedes.personal_id, id));
        if (data.sede_ids.length > 0) {
          await tx
            .insert(personalSedes)
            .values(
              data.sede_ids.map((sede_id) => ({
                personal_id: id,
                sede_id,
              }))
            )
            .onConflictDoNothing();
        }
        await this.syncUsuariosSedes(tx, id, data.sede_ids);
      }
    });

    return await this.getPersonalById(id);
  }

  /**
   * Eliminar o desactivar personal
   */
  async deletePersonal(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(personal)
        .set({ activo: false, updated_at: sql`CURRENT_TIMESTAMP` as any })
        .where(eq(personal.id, id));

      await tx
        .update(usuarios)
        .set({ activo: false, updated_at: sql`CURRENT_TIMESTAMP` as any })
        .where(eq(usuarios.personal_id, id));
    });
  }

  /**
   * Vincular cuenta de sistema a un personal existente
   */
  async vincularCuenta(personalId: number, data: VincularCuentaDTO): Promise<PersonalUsuarioInfo> {
    return await db.transaction(async (tx) => {
      const [colab] = await tx
        .select({ id: personal.id })
        .from(personal)
        .where(eq(personal.id, personalId));

      if (!colab) {
        throw new Error('Colaborador no encontrado');
      }

      const existingUser = await tx
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(eq(usuarios.personal_id, personalId));

      if (existingUser.length > 0) {
        throw new Error('El colaborador ya cuenta con un usuario de sistema vinculado');
      }

      const duplicateUser = await tx
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(or(eq(usuarios.username, data.username), eq(usuarios.email, data.email)));

      if (duplicateUser.length > 0) {
        throw new Error('El usuario o email ya está en uso');
      }

      const password_hash = await bcrypt.hash(data.password, 10);

      const [newUser] = await tx
        .insert(usuarios)
        .values({
          username: data.username,
          email: data.email,
          password_hash,
          rol_id: data.rol_id,
          personal_id: personalId,
        })
        .returning({
          id: usuarios.id,
          username: usuarios.username,
          email: usuarios.email,
          rol_id: usuarios.rol_id,
          activo: usuarios.activo,
        });

      // Copiar sedes del personal a usuarios_sedes
      const sedesPersonal = await tx
        .select({ sede_id: personalSedes.sede_id })
        .from(personalSedes)
        .where(eq(personalSedes.personal_id, personalId));

      if (sedesPersonal.length > 0) {
        await tx
          .insert(usuariosSedes)
          .values(
            sedesPersonal.map((s) => ({
              usuario_id: newUser.id,
              sede_id: s.sede_id,
            }))
          )
          .onConflictDoNothing();
      }

      const [rolRes] = await tx
        .select({ nombre: roles.nombre })
        .from(roles)
        .where(eq(roles.id, newUser.rol_id));

      return {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        rol_id: newUser.rol_id,
        rol_nombre: rolRes ? rolRes.nombre : '',
        activo: Boolean(newUser.activo),
      };
    });
  }

  /**
   * Desvincular / revocar cuenta de sistema de un colaborador
   */
  async desvincularCuenta(personalId: number): Promise<void> {
    const [u] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.personal_id, personalId));

    if (!u) {
      throw new Error('El colaborador no tiene una cuenta vinculada');
    }

    try {
      await db.delete(usuarios).where(eq(usuarios.id, u.id));
    } catch {
      await db
        .update(usuarios)
        .set({
          activo: false,
          personal_id: null,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(usuarios.id, u.id));
    }
  }

  /**
   * Dar de baja a un colaborador
   */
  async darDeBaja(
    id: number,
    data: DarDeBajaPersonalDTO,
    usuarioIdResponsable?: number | null
  ): Promise<Personal> {
    await db.transaction(async (tx) => {
      const [actual] = await tx
        .select()
        .from(personal)
        .where(eq(personal.id, id));

      if (!actual) {
        throw new Error('Colaborador no encontrado');
      }

      let motivoCeseId: number | null = data.motivo_cese_id || null;
      let motivoCeseTexto: string | null = data.motivo_cese || null;

      if (motivoCeseId && !motivoCeseTexto) {
        const [mcRes] = await tx
          .select({ nombre: personalMotivosCese.nombre })
          .from(personalMotivosCese)
          .where(eq(personalMotivosCese.id, motivoCeseId));
        if (mcRes) motivoCeseTexto = mcRes.nombre;
      } else if (!motivoCeseId && motivoCeseTexto) {
        const [mcRes] = await tx
          .select({ id: personalMotivosCese.id })
          .from(personalMotivosCese)
          .where(sql`LOWER(${personalMotivosCese.nombre}) = LOWER(${motivoCeseTexto.trim()})`);
        if (mcRes) motivoCeseId = mcRes.id;
      }

      await tx
        .update(personal)
        .set({
          activo: false,
          fecha_cese: data.fecha_cese,
          motivo_cese: motivoCeseTexto,
          motivo_cese_id: motivoCeseId,
          observaciones_cese: data.observaciones_cese || null,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(personal.id, id));

      await tx
        .update(usuarios)
        .set({
          activo: false,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(usuarios.personal_id, id));

      await this.registrarLogLaboral(tx, {
        personal_id: id,
        tipo_evento: 'CESE',
        fecha_evento: data.fecha_cese,
        cargo: actual.cargo,
        area: actual.area,
        tipo_contrato: actual.tipo_contrato,
        sueldo_base: actual.sueldo_base != null ? Number(actual.sueldo_base) : null,
        motivo_cese_id: motivoCeseId,
        motivo_cese_texto: motivoCeseTexto,
        observaciones: data.observaciones_cese || 'Cese / baja registrada',
        usuario_id: usuarioIdResponsable,
      });
    });

    return await this.getPersonalById(id);
  }

  /**
   * Reincorporar o reactivar a un colaborador previamente cesado
   */
  async reincorporar(id: number, usuarioIdResponsable?: number | null): Promise<Personal> {
    await db.transaction(async (tx) => {
      const [actual] = await tx
        .select()
        .from(personal)
        .where(eq(personal.id, id));

      if (!actual) {
        throw new Error('Colaborador no encontrado');
      }

      await tx
        .update(personal)
        .set({
          activo: true,
          fecha_cese: null,
          motivo_cese: null,
          motivo_cese_id: null,
          observaciones_cese: null,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(personal.id, id));

      const fechaHoy = new Date().toISOString().split('T')[0];
      await this.registrarLogLaboral(tx, {
        personal_id: id,
        tipo_evento: 'REINGRESO',
        fecha_evento: fechaHoy,
        cargo: actual.cargo,
        area: actual.area,
        tipo_contrato: actual.tipo_contrato,
        sueldo_base: actual.sueldo_base != null ? Number(actual.sueldo_base) : null,
        observaciones: 'Reincorporación / reactivación laboral del colaborador',
        usuario_id: usuarioIdResponsable,
      });
    });

    return await this.getPersonalById(id);
  }

  /**
   * Actualizar cuenta de usuario del colaborador
   */
  async updateCuenta(
    personalId: number,
    data: UpdateCuentaPersonalDTO
  ): Promise<PersonalUsuarioInfo> {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(eq(usuarios.personal_id, personalId));

      if (!user) {
        throw new Error('El colaborador no cuenta con un usuario de sistema vinculado');
      }

      const updateData: Partial<typeof usuarios.$inferInsert> = {
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      };

      if (data.activo !== undefined) updateData.activo = data.activo;
      if (data.rol_id !== undefined) updateData.rol_id = data.rol_id;
      if (data.email !== undefined) updateData.email = data.email.trim();
      if (data.password) {
        updateData.password_hash = await bcrypt.hash(data.password, 10);
      }

      await tx
        .update(usuarios)
        .set(updateData)
        .where(eq(usuarios.id, user.id));
    });

    const updatedInfo = await this.getPersonalUsuario(personalId);
    if (!updatedInfo) {
      throw new Error('Error al recuperar datos del usuario actualizado');
    }
    return updatedInfo;
  }
}

export const personalService = new PersonalService();
