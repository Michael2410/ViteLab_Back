import { eq, asc, sql } from 'drizzle-orm';
import { db, metodos } from '../../../db';
import type { Metodo, CreateMetodoInput, UpdateMetodoInput } from './metodos.types';

export class MetodosService {
  async getAll(): Promise<Metodo[]> {
    return db
      .select()
      .from(metodos)
      .orderBy(asc(metodos.nombre));
  }

  async getById(id: number): Promise<Metodo | null> {
    const [row] = await db
      .select()
      .from(metodos)
      .where(eq(metodos.id, id));
    return row || null;
  }

  async create(data: CreateMetodoInput): Promise<Metodo> {
    const [row] = await db
      .insert(metodos)
      .values({
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
      })
      .returning();
    return row;
  }

  async update(id: number, data: UpdateMetodoInput): Promise<Metodo | null> {
    const updateData: Partial<typeof metodos.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const [row] = await db
      .update(metodos)
      .set(updateData)
      .where(eq(metodos.id, id))
      .returning();

    return row || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(metodos)
      .where(eq(metodos.id, id))
      .returning({ id: metodos.id });
    return rows.length > 0;
  }

  async getActive(): Promise<Metodo[]> {
    return db
      .select()
      .from(metodos)
      .where(eq(metodos.activo, true))
      .orderBy(asc(metodos.nombre));
  }
}

export const metodosService = new MetodosService();
