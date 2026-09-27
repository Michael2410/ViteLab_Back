import { eq, asc, sql } from 'drizzle-orm';
import { db, convenios, tarifarios } from '../../../db';
import type {
  Convenio,
  CreateConvenioInput,
  UpdateConvenioInput,
  ConvenioWithTarifario,
} from './convenios.types';

export class ConveniosService {
  async getAll(): Promise<ConvenioWithTarifario[]> {
    const rows = await db
      .select({
        convenio: convenios,
        tarifario_id: tarifarios.id,
        tarifario_nombre: tarifarios.nombre,
      })
      .from(convenios)
      .leftJoin(tarifarios, eq(convenios.tarifario_id, tarifarios.id))
      .orderBy(asc(convenios.nombre_empresa));

    return rows.map((r) => ({
      ...r.convenio,
      tarifario: r.tarifario_id ? { id: r.tarifario_id, nombre: r.tarifario_nombre! } : null,
    }));
  }

  async getById(id: number): Promise<ConvenioWithTarifario | null> {
    const [row] = await db
      .select({
        convenio: convenios,
        tarifario_id: tarifarios.id,
        tarifario_nombre: tarifarios.nombre,
      })
      .from(convenios)
      .leftJoin(tarifarios, eq(convenios.tarifario_id, tarifarios.id))
      .where(eq(convenios.id, id));

    if (!row) return null;

    return {
      ...row.convenio,
      tarifario: row.tarifario_id ? { id: row.tarifario_id, nombre: row.tarifario_nombre! } : null,
    };
  }

  async create(data: CreateConvenioInput): Promise<Convenio> {
    const [row] = await db
      .insert(convenios)
      .values({
        nombre_empresa: data.nombre_empresa,
        ruc: data.ruc,
        direccion: data.direccion ?? null,
        telefono: data.telefono ?? null,
        email: data.email ?? null,
        tarifario_id: data.tarifario_id ?? null,
        logo_url: data.logo_url ?? null,
      })
      .returning();

    return row;
  }

  async update(id: number, data: UpdateConvenioInput): Promise<Convenio | null> {
    const updateData: Partial<typeof convenios.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.nombre_empresa !== undefined) updateData.nombre_empresa = data.nombre_empresa;
    if (data.ruc !== undefined) updateData.ruc = data.ruc;
    if (data.direccion !== undefined) updateData.direccion = data.direccion;
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.tarifario_id !== undefined) updateData.tarifario_id = data.tarifario_id;
    if (data.logo_url !== undefined) updateData.logo_url = data.logo_url;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const [row] = await db
      .update(convenios)
      .set(updateData)
      .where(eq(convenios.id, id))
      .returning();

    return row || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(convenios)
      .where(eq(convenios.id, id))
      .returning({ id: convenios.id });
    return rows.length > 0;
  }

  async getActive(): Promise<ConvenioWithTarifario[]> {
    const rows = await db
      .select({
        convenio: convenios,
        tarifario_id: tarifarios.id,
        tarifario_nombre: tarifarios.nombre,
      })
      .from(convenios)
      .leftJoin(tarifarios, eq(convenios.tarifario_id, tarifarios.id))
      .where(eq(convenios.activo, true))
      .orderBy(asc(convenios.nombre_empresa));

    return rows.map((r) => ({
      ...r.convenio,
      tarifario: r.tarifario_id ? { id: r.tarifario_id, nombre: r.tarifario_nombre! } : null,
    }));
  }
}

export const conveniosService = new ConveniosService();
