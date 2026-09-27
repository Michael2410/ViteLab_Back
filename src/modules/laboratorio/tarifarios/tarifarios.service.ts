import { eq, and, asc, sql } from 'drizzle-orm';
import { db, tarifarios, tarifarioPrecios, analisis } from '../../../db';
import type {
  Tarifario,
  CreateTarifarioInput,
  UpdateTarifarioInput,
  TarifarioWithPrecios,
  TarifarioPrecio,
  CreateTarifarioPrecioInput,
  UpdateTarifarioPrecioInput,
} from './tarifarios.types';

export class TarifariosService {
  // TARIFARIOS
  async getAll(): Promise<Tarifario[]> {
    return db
      .select()
      .from(tarifarios)
      .orderBy(asc(tarifarios.nombre));
  }

  async getById(id: number): Promise<Tarifario | null> {
    const [row] = await db
      .select()
      .from(tarifarios)
      .where(eq(tarifarios.id, id));
    return row || null;
  }

  async getByIdWithPrecios(id: number): Promise<TarifarioWithPrecios | null> {
    const [tarifario] = await db
      .select()
      .from(tarifarios)
      .where(eq(tarifarios.id, id));

    if (!tarifario) return null;

    const precios = await db
      .select({
        id: tarifarioPrecios.id,
        analisis_id: tarifarioPrecios.analisis_id,
        analisis_nombre: analisis.nombre,
        precio: tarifarioPrecios.precio,
      })
      .from(tarifarioPrecios)
      .innerJoin(analisis, eq(tarifarioPrecios.analisis_id, analisis.id))
      .where(eq(tarifarioPrecios.tarifario_id, id))
      .orderBy(asc(analisis.nombre));

    return {
      ...tarifario,
      precios,
    };
  }

  async create(data: CreateTarifarioInput): Promise<Tarifario> {
    const [row] = await db
      .insert(tarifarios)
      .values({
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
      })
      .returning();
    return row;
  }

  async update(id: number, data: UpdateTarifarioInput): Promise<Tarifario | null> {
    const updateData: Partial<typeof tarifarios.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const [row] = await db
      .update(tarifarios)
      .set(updateData)
      .where(eq(tarifarios.id, id))
      .returning();

    return row || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(tarifarios)
      .where(eq(tarifarios.id, id))
      .returning({ id: tarifarios.id });
    return rows.length > 0;
  }

  async getActive(): Promise<Tarifario[]> {
    return db
      .select()
      .from(tarifarios)
      .where(eq(tarifarios.activo, true))
      .orderBy(asc(tarifarios.nombre));
  }

  // PRECIOS
  async createPrecio(data: CreateTarifarioPrecioInput): Promise<TarifarioPrecio> {
    const [row] = await db
      .insert(tarifarioPrecios)
      .values({
        tarifario_id: data.tarifario_id,
        analisis_id: data.analisis_id,
        precio: String(data.precio),
      })
      .returning();
    return row;
  }

  async updatePrecio(id: number, data: UpdateTarifarioPrecioInput): Promise<TarifarioPrecio | null> {
    const [row] = await db
      .update(tarifarioPrecios)
      .set({
        precio: String(data.precio),
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      })
      .where(eq(tarifarioPrecios.id, id))
      .returning();

    return row || null;
  }

  async deletePrecio(id: number): Promise<boolean> {
    const rows = await db
      .delete(tarifarioPrecios)
      .where(eq(tarifarioPrecios.id, id))
      .returning({ id: tarifarioPrecios.id });
    return rows.length > 0;
  }

  async getPrecioByTarifarioAndAnalisis(
    tarifarioId: number,
    analisisId: number
  ): Promise<TarifarioPrecio | null> {
    const [row] = await db
      .select()
      .from(tarifarioPrecios)
      .where(
        and(
          eq(tarifarioPrecios.tarifario_id, tarifarioId),
          eq(tarifarioPrecios.analisis_id, analisisId)
        )
      );

    return row || null;
  }
}

export const tarifariosService = new TarifariosService();
