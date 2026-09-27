import { db, sedes } from '../../db';
import { eq, asc } from 'drizzle-orm';
import type { Sede, CreateSedeInput, UpdateSedeInput } from './sedes.types';

export class SedesService {
  async getAll(): Promise<Sede[]> {
    return (await db.select().from(sedes).orderBy(asc(sedes.nombre))) as Sede[];
  }

  async getById(id: number): Promise<Sede | null> {
    const [result] = await db.select().from(sedes).where(eq(sedes.id, id));
    return (result as Sede) || null;
  }

  async create(data: CreateSedeInput): Promise<Sede> {
    const [result] = await db
      .insert(sedes)
      .values({
        nombre: data.nombre,
        direccion: data.direccion || null,
        telefono: data.telefono || null,
      })
      .returning();
    return result as Sede;
  }

  async update(id: number, data: UpdateSedeInput): Promise<Sede | null> {
    const updateData: Partial<typeof sedes.$inferInsert> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.direccion !== undefined) updateData.direccion = data.direccion;
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.activo !== undefined) updateData.activo = data.activo;

    if (Object.keys(updateData).length === 0) return this.getById(id);

    const [result] = await db
      .update(sedes)
      .set(updateData)
      .where(eq(sedes.id, id))
      .returning();

    return (result as Sede) || null;
  }

  async delete(id: number): Promise<boolean> {
    const [result] = await db.delete(sedes).where(eq(sedes.id, id)).returning({ id: sedes.id });
    return Boolean(result);
  }

  async getActive(): Promise<Sede[]> {
    return (await db
      .select()
      .from(sedes)
      .where(eq(sedes.activo, true))
      .orderBy(asc(sedes.nombre))) as Sede[];
  }
}

export const sedesService = new SedesService();

