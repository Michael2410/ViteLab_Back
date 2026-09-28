import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db, almacenProveedores } from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import type { Paginado } from '../shared/almacen.types';
import type {
  ListarProveedoresQuery,
  CrearProveedorInput,
  ActualizarProveedorInput,
} from './proveedores.schema';
import type { AlmacenProveedor } from './proveedores.types';

export class AlmacenProveedoresService {
  async listar(f: ListarProveedoresQuery): Promise<Paginado<AlmacenProveedor>> {
    const conditions: (SQL | undefined)[] = [];
    if (f.search) {
      const s = `%${f.search}%`;
      conditions.push(
        or(
          ilike(almacenProveedores.razon_social, s),
          ilike(almacenProveedores.nombre_comercial, s),
          ilike(almacenProveedores.ruc, s)
        )
      );
    }
    if (f.activo !== undefined) conditions.push(eq(almacenProveedores.activo, f.activo));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(almacenProveedores).where(where);
    const items = await db
      .select()
      .from(almacenProveedores)
      .where(where)
      .orderBy(asc(almacenProveedores.razon_social))
      .limit(f.limit)
      .offset((f.page - 1) * f.limit);

    return {
      items,
      total,
      page: f.page,
      limit: f.limit,
      totalPages: Math.ceil(total / f.limit),
    };
  }

  async obtener(id: number): Promise<AlmacenProveedor> {
    const [row] = await db.select().from(almacenProveedores).where(eq(almacenProveedores.id, id));
    if (!row) throw new AlmacenError('Proveedor no encontrado', 404);
    return row;
  }

  async crear(data: CrearProveedorInput): Promise<AlmacenProveedor> {
    const ruc = data.ruc?.trim() || null;
    if (ruc) {
      const [dup] = await db
        .select({ id: almacenProveedores.id })
        .from(almacenProveedores)
        .where(eq(almacenProveedores.ruc, ruc));
      if (dup) throw new AlmacenError(`Ya existe un proveedor con el RUC "${ruc}"`, 409);
    }
    const [row] = await db
      .insert(almacenProveedores)
      .values({
        ...data,
        ruc,
      })
      .returning();
    return row;
  }

  async actualizar(id: number, data: ActualizarProveedorInput): Promise<AlmacenProveedor> {
    await this.obtener(id);
    const ruc = data.ruc === undefined ? undefined : data.ruc?.trim() || null;
    if (ruc) {
      const [dup] = await db
        .select({ id: almacenProveedores.id })
        .from(almacenProveedores)
        .where(eq(almacenProveedores.ruc, ruc));
      if (dup && dup.id !== id) {
        throw new AlmacenError(`Ya existe otro proveedor con el RUC "${ruc}"`, 409);
      }
    }
    const [row] = await db
      .update(almacenProveedores)
      .set({
        ...data,
        ruc,
      })
      .where(eq(almacenProveedores.id, id))
      .returning();
    return row;
  }

  async desactivar(id: number): Promise<AlmacenProveedor> {
    const [row] = await db
      .update(almacenProveedores)
      .set({ activo: false })
      .where(eq(almacenProveedores.id, id))
      .returning();
    if (!row) throw new AlmacenError('Proveedor no encontrado', 404);
    return row;
  }
}

export const almacenProveedoresService = new AlmacenProveedoresService();
