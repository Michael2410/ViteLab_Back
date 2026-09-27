import { eq, asc, sql } from 'drizzle-orm';
import { db, tiposCliente } from '../../../db';
import type { TipoCliente, CreateTipoClienteInput, UpdateTipoClienteInput } from './tipos-cliente.types';

export class TiposClienteService {
  async getAll(): Promise<TipoCliente[]> {
    return db
      .select()
      .from(tiposCliente)
      .orderBy(asc(tiposCliente.nombre));
  }

  async getById(id: number): Promise<TipoCliente | null> {
    const [row] = await db
      .select()
      .from(tiposCliente)
      .where(eq(tiposCliente.id, id));
    return row || null;
  }

  async create(data: CreateTipoClienteInput): Promise<TipoCliente> {
    const [row] = await db
      .insert(tiposCliente)
      .values({
        nombre: data.nombre,
      })
      .returning();
    return row;
  }

  async update(id: number, data: UpdateTipoClienteInput): Promise<TipoCliente | null> {
    const updateData: Partial<typeof tiposCliente.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const [row] = await db
      .update(tiposCliente)
      .set(updateData)
      .where(eq(tiposCliente.id, id))
      .returning();

    return row || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(tiposCliente)
      .where(eq(tiposCliente.id, id))
      .returning({ id: tiposCliente.id });
    return rows.length > 0;
  }

  async getActive(): Promise<TipoCliente[]> {
    return db
      .select()
      .from(tiposCliente)
      .where(eq(tiposCliente.activo, true))
      .orderBy(asc(tiposCliente.nombre));
  }
}

export const tiposClienteService = new TiposClienteService();
