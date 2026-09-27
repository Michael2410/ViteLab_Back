import { eq, and, asc, count, sql } from 'drizzle-orm';
import {
  db,
  personalCargos,
  personalAreas,
  personalTiposContrato,
  personalMotivosCese,
  personal,
} from '../../../db';
import {
  CatalogoTipo,
  PersonalCatalogoItem,
  CreatePersonalCatalogoDTO,
  UpdatePersonalCatalogoDTO,
} from './personal-catalogos.types';

type AnyPersonalCatalogoTable =
  | typeof personalCargos
  | typeof personalAreas
  | typeof personalTiposContrato
  | typeof personalMotivosCese;

interface CatalogoConfig {
  table: AnyPersonalCatalogoTable;
  fkCol: any;
  textColKey: 'cargo' | 'area' | 'tipo_contrato' | 'motivo_cese';
  singular: string;
}

const CATALOGO_CONFIGS: Record<CatalogoTipo, CatalogoConfig> = {
  cargos: {
    table: personalCargos,
    fkCol: personal.cargo_id,
    textColKey: 'cargo',
    singular: 'Cargo',
  },
  areas: {
    table: personalAreas,
    fkCol: personal.area_id,
    textColKey: 'area',
    singular: 'Área',
  },
  'tipos-contrato': {
    table: personalTiposContrato,
    fkCol: personal.tipo_contrato_id,
    textColKey: 'tipo_contrato',
    singular: 'Tipo de Contrato',
  },
  'motivos-cese': {
    table: personalMotivosCese,
    fkCol: personal.motivo_cese_id,
    textColKey: 'motivo_cese',
    singular: 'Motivo de Cese',
  },
};

export class PersonalCatalogosService {
  private getConfig(tipo: CatalogoTipo): CatalogoConfig {
    const config = CATALOGO_CONFIGS[tipo];
    if (!config) {
      throw new Error(`Tipo de catálogo no válido: ${tipo}`);
    }
    return config;
  }

  /**
   * Listar todos los elementos de un catálogo con contador de colaboradores asignados
   */
  async getAll(tipo: CatalogoTipo, soloActivos: boolean = false): Promise<PersonalCatalogoItem[]> {
    const { table, fkCol } = this.getConfig(tipo);

    const conditions = soloActivos ? [eq(table.activo, true)] : [];

    const rows = await db
      .select({
        id: table.id,
        nombre: table.nombre,
        descripcion: table.descripcion,
        activo: table.activo,
        created_at: table.created_at,
        updated_at: table.updated_at,
        total_personal: count(personal.id),
      })
      .from(table)
      .leftJoin(personal, eq(fkCol, table.id))
      .where(and(...conditions))
      .groupBy(
        table.id,
        table.nombre,
        table.descripcion,
        table.activo,
        table.created_at,
        table.updated_at
      )
      .orderBy(asc(table.nombre));

    return rows.map((r: any) => ({
      ...r,
      total_personal: Number(r.total_personal || 0),
    }));
  }

  /**
   * Obtener un elemento de catálogo por ID
   */
  async getById(tipo: CatalogoTipo, id: number): Promise<PersonalCatalogoItem> {
    const { table, fkCol, singular } = this.getConfig(tipo);

    const [row] = await db
      .select({
        id: table.id,
        nombre: table.nombre,
        descripcion: table.descripcion,
        activo: table.activo,
        created_at: table.created_at,
        updated_at: table.updated_at,
        total_personal: count(personal.id),
      })
      .from(table)
      .leftJoin(personal, eq(fkCol, table.id))
      .where(eq(table.id, id))
      .groupBy(
        table.id,
        table.nombre,
        table.descripcion,
        table.activo,
        table.created_at,
        table.updated_at
      );

    if (!row) {
      throw new Error(`${singular} no encontrado`);
    }

    return {
      ...(row as any),
      total_personal: Number((row as any).total_personal || 0),
    };
  }

  /**
   * Crear un nuevo elemento en el catálogo
   */
  async create(tipo: CatalogoTipo, data: CreatePersonalCatalogoDTO): Promise<PersonalCatalogoItem> {
    const { table, singular } = this.getConfig(tipo);

    const nombreLimpio = data.nombre.trim();
    if (!nombreLimpio) {
      throw new Error(`El nombre de ${singular.toLowerCase()} es obligatorio`);
    }

    // Verificar nombre duplicado case-insensitive
    const duplicate = await db
      .select({ id: table.id })
      .from(table)
      .where(sql`LOWER(${table.nombre}) = LOWER(${nombreLimpio})`);

    if (duplicate.length > 0) {
      throw new Error(`Ya existe un registro con el nombre "${nombreLimpio}"`);
    }

    const [inserted] = await (db.insert(table as any) as any)
      .values({
        nombre: nombreLimpio,
        descripcion: data.descripcion?.trim() || null,
        activo: data.activo !== undefined ? data.activo : true,
      })
      .returning();

    return {
      ...inserted,
      total_personal: 0,
    };
  }

  /**
   * Actualizar un elemento del catálogo
   */
  async update(
    tipo: CatalogoTipo,
    id: number,
    data: UpdatePersonalCatalogoDTO
  ): Promise<PersonalCatalogoItem> {
    const { table, singular, textColKey, fkCol } = this.getConfig(tipo);

    // Verificar existencia
    const [current] = await db
      .select({ id: table.id, nombre: table.nombre })
      .from(table)
      .where(eq(table.id, id));

    if (!current) {
      throw new Error(`${singular} no encontrado`);
    }

    // Verificar nombre duplicado si cambia
    if (data.nombre) {
      const nombreLimpio = data.nombre.trim();
      const duplicate = await db
        .select({ id: table.id })
        .from(table)
        .where(
          and(
            sql`LOWER(${table.nombre}) = LOWER(${nombreLimpio})`,
            sql`${table.id} != ${id}`
          )
        );

      if (duplicate.length > 0) {
        throw new Error(`Ya existe otro registro con el nombre "${nombreLimpio}"`);
      }
    }

    const updateData: any = {
      updated_at: sql`CURRENT_TIMESTAMP`,
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre.trim();
    if (data.descripcion !== undefined) {
      updateData.descripcion = data.descripcion ? data.descripcion.trim() : null;
    }
    if (data.activo !== undefined) updateData.activo = data.activo;

    await db.transaction(async (tx) => {
      await (tx.update(table as any) as any)
        .set(updateData)
        .where(eq(table.id, id));

      // Sincronizar el texto histórico en la tabla personal si se renombró el catálogo
      if (data.nombre && data.nombre.trim() !== current.nombre) {
        await tx
          .update(personal)
          .set({ [textColKey]: data.nombre.trim() })
          .where(eq(fkCol, id));
      }
    });

    return await this.getById(tipo, id);
  }

  /**
   * Eliminar o desactivar un elemento de catálogo
   */
  async delete(tipo: CatalogoTipo, id: number): Promise<{ softDeleted: boolean; message: string }> {
    const { table, fkCol, singular } = this.getConfig(tipo);

    // Verificar cuántos colaboradores lo tienen asignado
    const [checkRes] = await db
      .select({ count: count() })
      .from(personal)
      .where(eq(fkCol, id));

    const totalAsignados = Number(checkRes?.count || 0);

    if (totalAsignados > 0) {
      // Desactivación lógica para preservar integridad
      await (db.update(table as any) as any)
        .set({ activo: false, updated_at: sql`CURRENT_TIMESTAMP` })
        .where(eq(table.id, id));

      return {
        softDeleted: true,
        message: `${singular} desactivado correctamente. No se eliminó físicamente porque está asignado a ${totalAsignados} colaborador(es).`,
      };
    } else {
      // Eliminación física directa
      const delRes = await (db.delete(table as any) as any)
        .where(eq(table.id, id))
        .returning({ id: table.id });

      if (delRes.length === 0) {
        throw new Error(`${singular} no encontrado`);
      }

      return {
        softDeleted: false,
        message: `${singular} eliminado permanentemente.`,
      };
    }
  }
}

export const personalCatalogosService = new PersonalCatalogosService();
