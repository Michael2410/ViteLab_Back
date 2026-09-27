import { eq, asc, sql } from 'drizzle-orm';
import { db, muestras } from '../../../db';
import type { Muestra, CreateMuestraInput, UpdateMuestraInput } from './muestras.types';

export class MuestrasService {
  async getAll(): Promise<Muestra[]> {
    return db
      .select()
      .from(muestras)
      .orderBy(asc(muestras.nombre));
  }

  async getById(id: number): Promise<Muestra | null> {
    const [row] = await db
      .select()
      .from(muestras)
      .where(eq(muestras.id, id));
    return row || null;
  }

  async getActive(): Promise<Muestra[]> {
    return db
      .select()
      .from(muestras)
      .where(eq(muestras.activo, true))
      .orderBy(asc(muestras.nombre));
  }

  async create(data: CreateMuestraInput): Promise<Muestra> {
    const [row] = await db
      .insert(muestras)
      .values({
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
      })
      .returning();
    return row;
  }

  async update(id: number, data: UpdateMuestraInput): Promise<Muestra | null> {
    const updateData: Partial<typeof muestras.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const [row] = await db
      .update(muestras)
      .set(updateData)
      .where(eq(muestras.id, id))
      .returning();

    return row || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(muestras)
      .where(eq(muestras.id, id))
      .returning({ id: muestras.id });
    return rows.length > 0;
  }
}

export const muestrasService = new MuestrasService();
