import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import {
  db,
  almacenUnidadesMedida,
  almacenCategorias,
  almacenAlmacenes,
  almacenUbicaciones,
  sedes,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import type {
  UnidadMedidaInput,
  CategoriaInput,
  AlmacenInput,
  UbicacionInput,
} from './maestros.schema';
import type {
  AlmacenUnidadMedida,
  AlmacenCategoria,
  AlmacenEntity,
  AlmacenConSede,
  AlmacenUbicacion,
} from './maestros.types';

export class AlmacenMaestrosService {
  // ==========================================
  // UNIDADES DE MEDIDA
  // ==========================================
  async listarUnidades(activo?: boolean): Promise<AlmacenUnidadMedida[]> {
    const conditions: (SQL | undefined)[] = [];
    if (activo !== undefined) conditions.push(eq(almacenUnidadesMedida.activo, activo));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(almacenUnidadesMedida).where(where).orderBy(asc(almacenUnidadesMedida.nombre));
  }

  async crearUnidad(data: UnidadMedidaInput): Promise<AlmacenUnidadMedida> {
    const codigo = data.codigo.trim().toUpperCase();
    const [dup] = await db
      .select({ id: almacenUnidadesMedida.id })
      .from(almacenUnidadesMedida)
      .where(eq(almacenUnidadesMedida.codigo, codigo));
    if (dup) throw new AlmacenError(`Ya existe una unidad de medida con código "${codigo}"`, 409);

    const [creada] = await db
      .insert(almacenUnidadesMedida)
      .values({
        codigo,
        nombre: data.nombre.trim(),
        permite_decimales: data.permite_decimales ?? false,
      })
      .returning();
    return creada;
  }

  async actualizarUnidad(
    id: number,
    data: Partial<UnidadMedidaInput> & { activo?: boolean }
  ): Promise<AlmacenUnidadMedida> {
    const [actual] = await db.select().from(almacenUnidadesMedida).where(eq(almacenUnidadesMedida.id, id));
    if (!actual) throw new AlmacenError('Unidad de medida no encontrada', 404);

    if (data.codigo && data.codigo.trim().toUpperCase() !== actual.codigo) {
      const codigo = data.codigo.trim().toUpperCase();
      const [dup] = await db
        .select({ id: almacenUnidadesMedida.id })
        .from(almacenUnidadesMedida)
        .where(eq(almacenUnidadesMedida.codigo, codigo));
      if (dup) throw new AlmacenError(`Ya existe una unidad de medida con código "${codigo}"`, 409);
    }

    const [actualizada] = await db
      .update(almacenUnidadesMedida)
      .set({
        ...(data.codigo ? { codigo: data.codigo.trim().toUpperCase() } : {}),
        ...(data.nombre ? { nombre: data.nombre.trim() } : {}),
        ...(data.permite_decimales !== undefined ? { permite_decimales: data.permite_decimales } : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
      })
      .where(eq(almacenUnidadesMedida.id, id))
      .returning();
    return actualizada;
  }

  async desactivarUnidad(id: number): Promise<AlmacenUnidadMedida> {
    const [desactivada] = await db
      .update(almacenUnidadesMedida)
      .set({ activo: false })
      .where(eq(almacenUnidadesMedida.id, id))
      .returning();
    if (!desactivada) throw new AlmacenError('Unidad de medida no encontrada', 404);
    return desactivada;
  }

  // ==========================================
  // CATEGORÍAS
  // ==========================================
  async listarCategorias(activo?: boolean): Promise<AlmacenCategoria[]> {
    const conditions: (SQL | undefined)[] = [];
    if (activo !== undefined) conditions.push(eq(almacenCategorias.activo, activo));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(almacenCategorias).where(where).orderBy(asc(almacenCategorias.nombre));
  }

  async crearCategoria(data: CategoriaInput): Promise<AlmacenCategoria> {
    const nombre = data.nombre.trim();
    const [dup] = await db
      .select({ id: almacenCategorias.id })
      .from(almacenCategorias)
      .where(eq(almacenCategorias.nombre, nombre));
    if (dup) throw new AlmacenError(`Ya existe una categoría con nombre "${nombre}"`, 409);

    const [creada] = await db
      .insert(almacenCategorias)
      .values({
        nombre,
        descripcion: data.descripcion?.trim() || null,
      })
      .returning();
    return creada;
  }

  async actualizarCategoria(
    id: number,
    data: Partial<CategoriaInput> & { activo?: boolean }
  ): Promise<AlmacenCategoria> {
    const [actual] = await db.select().from(almacenCategorias).where(eq(almacenCategorias.id, id));
    if (!actual) throw new AlmacenError('Categoría no encontrada', 404);

    if (data.nombre && data.nombre.trim() !== actual.nombre) {
      const nombre = data.nombre.trim();
      const [dup] = await db
        .select({ id: almacenCategorias.id })
        .from(almacenCategorias)
        .where(eq(almacenCategorias.nombre, nombre));
      if (dup) throw new AlmacenError(`Ya existe una categoría con nombre "${nombre}"`, 409);
    }

    const [actualizada] = await db
      .update(almacenCategorias)
      .set({
        ...(data.nombre ? { nombre: data.nombre.trim() } : {}),
        ...(data.descripcion !== undefined ? { descripcion: data.descripcion?.trim() || null } : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
      })
      .where(eq(almacenCategorias.id, id))
      .returning();
    return actualizada;
  }

  async desactivarCategoria(id: number): Promise<AlmacenCategoria> {
    const [desactivada] = await db
      .update(almacenCategorias)
      .set({ activo: false })
      .where(eq(almacenCategorias.id, id))
      .returning();
    if (!desactivada) throw new AlmacenError('Categoría no encontrada', 404);
    return desactivada;
  }

  // ==========================================
  // ALMACENES (POR SEDE)
  // ==========================================
  async listarAlmacenes(
    sedesPermitidas?: number[],
    sedeIdFiltro?: number,
    activo?: boolean
  ): Promise<AlmacenConSede[]> {
    const conditions: (SQL | undefined)[] = [];

    if (activo !== undefined) conditions.push(eq(almacenAlmacenes.activo, activo));

    if (sedeIdFiltro) {
      if (sedesPermitidas !== undefined && !sedesPermitidas.includes(sedeIdFiltro)) {
        return [];
      }
      conditions.push(eq(almacenAlmacenes.sede_id, sedeIdFiltro));
    } else if (sedesPermitidas !== undefined) {
      if (sedesPermitidas.length === 0) return [];
      conditions.push(inArray(almacenAlmacenes.sede_id, sedesPermitidas));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: almacenAlmacenes.id,
        nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        descripcion: almacenAlmacenes.descripcion,
        es_principal: almacenAlmacenes.es_principal,
        responsable_usuario_id: almacenAlmacenes.responsable_usuario_id,
        activo: almacenAlmacenes.activo,
        legacy_id: almacenAlmacenes.legacy_id,
        created_at: almacenAlmacenes.created_at,
        updated_at: almacenAlmacenes.updated_at,
        sede_nombre: sedes.nombre,
      })
      .from(almacenAlmacenes)
      .leftJoin(sedes, eq(almacenAlmacenes.sede_id, sedes.id))
      .where(where)
      .orderBy(asc(almacenAlmacenes.nombre));

    return rows;
  }

  async obtenerAlmacen(id: number): Promise<AlmacenConSede> {
    const [row] = await db
      .select({
        id: almacenAlmacenes.id,
        nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        descripcion: almacenAlmacenes.descripcion,
        es_principal: almacenAlmacenes.es_principal,
        responsable_usuario_id: almacenAlmacenes.responsable_usuario_id,
        activo: almacenAlmacenes.activo,
        legacy_id: almacenAlmacenes.legacy_id,
        created_at: almacenAlmacenes.created_at,
        updated_at: almacenAlmacenes.updated_at,
        sede_nombre: sedes.nombre,
      })
      .from(almacenAlmacenes)
      .leftJoin(sedes, eq(almacenAlmacenes.sede_id, sedes.id))
      .where(eq(almacenAlmacenes.id, id));

    if (!row) throw new AlmacenError('Almacén no encontrado', 404);
    return row;
  }

  async crearAlmacen(data: AlmacenInput, sedesPermitidas?: number[]): Promise<AlmacenEntity> {
    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(data.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede asignada al almacén', 403);
    }

    const nombre = data.nombre.trim();
    const [dup] = await db
      .select({ id: almacenAlmacenes.id })
      .from(almacenAlmacenes)
      .where(and(eq(almacenAlmacenes.nombre, nombre), eq(almacenAlmacenes.sede_id, data.sede_id)));
    if (dup) throw new AlmacenError(`Ya existe un almacén con nombre "${nombre}" en esta sede`, 409);

    const [creado] = await db
      .insert(almacenAlmacenes)
      .values({
        nombre,
        sede_id: data.sede_id,
        descripcion: data.descripcion?.trim() || null,
        es_principal: data.es_principal ?? false,
        responsable_usuario_id: data.responsable_usuario_id ?? null,
      })
      .returning();
    return creado;
  }

  async actualizarAlmacen(
    id: number,
    data: Partial<AlmacenInput> & { activo?: boolean },
    sedesPermitidas?: number[]
  ): Promise<AlmacenEntity> {
    const actual = await this.obtenerAlmacen(id);
    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(actual.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede de este almacén', 403);
    }

    const sedeDestino = data.sede_id ?? actual.sede_id;
    if (data.sede_id && sedesPermitidas !== undefined && !sedesPermitidas.includes(data.sede_id)) {
      throw new AlmacenError('No tienes acceso a la nueva sede seleccionada', 403);
    }

    const nuevoNombre = data.nombre ? data.nombre.trim() : actual.nombre;
    if (data.nombre || data.sede_id) {
      const [dup] = await db
        .select({ id: almacenAlmacenes.id })
        .from(almacenAlmacenes)
        .where(
          and(
            eq(almacenAlmacenes.nombre, nuevoNombre),
            eq(almacenAlmacenes.sede_id, sedeDestino)
          )
        );
      if (dup && dup.id !== id) {
        throw new AlmacenError(`Ya existe un almacén con nombre "${nuevoNombre}" en la sede`, 409);
      }
    }

    const [actualizado] = await db
      .update(almacenAlmacenes)
      .set({
        ...(data.nombre ? { nombre: nuevoNombre } : {}),
        ...(data.sede_id ? { sede_id: data.sede_id } : {}),
        ...(data.descripcion !== undefined ? { descripcion: data.descripcion?.trim() || null } : {}),
        ...(data.es_principal !== undefined ? { es_principal: data.es_principal } : {}),
        ...(data.responsable_usuario_id !== undefined
          ? { responsable_usuario_id: data.responsable_usuario_id }
          : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
      })
      .where(eq(almacenAlmacenes.id, id))
      .returning();
    return actualizado;
  }

  async desactivarAlmacen(id: number, sedesPermitidas?: number[]): Promise<AlmacenEntity> {
    const actual = await this.obtenerAlmacen(id);
    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(actual.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede de este almacén', 403);
    }

    const [desactivado] = await db
      .update(almacenAlmacenes)
      .set({ activo: false })
      .where(eq(almacenAlmacenes.id, id))
      .returning();
    return desactivado;
  }

  // ==========================================
  // UBICACIONES
  // ==========================================
  async listarUbicaciones(almacenId?: number, activo?: boolean): Promise<AlmacenUbicacion[]> {
    const conditions: (SQL | undefined)[] = [];
    if (almacenId) conditions.push(eq(almacenUbicaciones.almacen_id, almacenId));
    if (activo !== undefined) conditions.push(eq(almacenUbicaciones.activo, activo));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(almacenUbicaciones).where(where).orderBy(asc(almacenUbicaciones.codigo));
  }

  async crearUbicacion(data: UbicacionInput): Promise<AlmacenUbicacion> {
    const codigo = data.codigo.trim().toUpperCase();
    const [dup] = await db
      .select({ id: almacenUbicaciones.id })
      .from(almacenUbicaciones)
      .where(
        and(
          eq(almacenUbicaciones.almacen_id, data.almacen_id),
          eq(almacenUbicaciones.codigo, codigo)
        )
      );
    if (dup) throw new AlmacenError(`Ya existe la ubicación "${codigo}" en este almacén`, 409);

    const [creada] = await db
      .insert(almacenUbicaciones)
      .values({
        almacen_id: data.almacen_id,
        codigo,
        nombre: data.nombre.trim(),
        tipo: data.tipo?.trim() || 'ESTANTE',
        temp_min: data.temp_min !== undefined ? data.temp_min : null,
        temp_max: data.temp_max !== undefined ? data.temp_max : null,
      })
      .returning();
    return creada;
  }

  async actualizarUbicacion(
    id: number,
    data: Partial<UbicacionInput> & { activo?: boolean }
  ): Promise<AlmacenUbicacion> {
    const [actual] = await db.select().from(almacenUbicaciones).where(eq(almacenUbicaciones.id, id));
    if (!actual) throw new AlmacenError('Ubicación no encontrada', 404);

    const nuevoAlmacen = data.almacen_id ?? actual.almacen_id;
    const nuevoCodigo = data.codigo ? data.codigo.trim().toUpperCase() : actual.codigo;

    if (data.codigo || data.almacen_id) {
      const [dup] = await db
        .select({ id: almacenUbicaciones.id })
        .from(almacenUbicaciones)
        .where(
          and(
            eq(almacenUbicaciones.almacen_id, nuevoAlmacen),
            eq(almacenUbicaciones.codigo, nuevoCodigo)
          )
        );
      if (dup && dup.id !== id) {
        throw new AlmacenError(`Ya existe la ubicación "${nuevoCodigo}" en el almacén`, 409);
      }
    }

    const [actualizada] = await db
      .update(almacenUbicaciones)
      .set({
        ...(data.almacen_id ? { almacen_id: data.almacen_id } : {}),
        ...(data.codigo ? { codigo: nuevoCodigo } : {}),
        ...(data.nombre ? { nombre: data.nombre.trim() } : {}),
        ...(data.tipo !== undefined ? { tipo: data.tipo?.trim() || 'ESTANTE' } : {}),
        ...(data.temp_min !== undefined ? { temp_min: data.temp_min } : {}),
        ...(data.temp_max !== undefined ? { temp_max: data.temp_max } : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
      })
      .where(eq(almacenUbicaciones.id, id))
      .returning();
    return actualizada;
  }

  async desactivarUbicacion(id: number): Promise<AlmacenUbicacion> {
    const [desactivada] = await db
      .update(almacenUbicaciones)
      .set({ activo: false })
      .where(eq(almacenUbicaciones.id, id))
      .returning();
    if (!desactivada) throw new AlmacenError('Ubicación no encontrada', 404);
    return desactivada;
  }
}

export const almacenMaestrosService = new AlmacenMaestrosService();
