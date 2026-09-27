import { eq, asc, sql } from 'drizzle-orm';
import { db, areas } from '../../../db';
import type { Area, CreateAreaInput, UpdateAreaInput } from './areas.types';

export class AreasService {
  async getAll(): Promise<Area[]> {
    return db
      .select()
      .from(areas)
      .orderBy(asc(areas.nombre));
  }

  async getById(id: number): Promise<Area | null> {
    const [row] = await db
      .select()
      .from(areas)
      .where(eq(areas.id, id));
    return row || null;
  }

  async create(data: CreateAreaInput): Promise<Area> {
    const [row] = await db
      .insert(areas)
      .values({
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
      })
      .returning();
    return row;
  }

  async update(id: number, data: UpdateAreaInput): Promise<Area | null> {
    const updateData: Partial<typeof areas.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const [row] = await db
      .update(areas)
      .set(updateData)
      .where(eq(areas.id, id))
      .returning();

    return row || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(areas)
      .where(eq(areas.id, id))
      .returning({ id: areas.id });
    return rows.length > 0;
  }

  async getActive(): Promise<Area[]> {
    return db
      .select()
      .from(areas)
      .where(eq(areas.activo, true))
      .orderBy(asc(areas.nombre));
  }
}

export const areasService = new AreasService();
