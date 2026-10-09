import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db, almacenProductos, almacenCategorias, almacenUnidadesMedida } from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { buildMultiFilter } from '../shared/almacen.filters';
import type { Paginado } from '../shared/almacen.types';
import type { ListarProductosQuery, CrearProductoInput, ActualizarProductoInput } from './productos.schema';
import type { AlmacenProducto, AlmacenProductoListado } from './productos.types';

export class AlmacenProductosService {
  async listar(f: ListarProductosQuery): Promise<Paginado<AlmacenProductoListado>> {
    const conditions: (SQL | undefined)[] = [];
    if (f.search) {
      const s = `%${f.search}%`;
      conditions.push(or(ilike(almacenProductos.nombre, s), ilike(almacenProductos.codigo, s)));
    }
    const cCat = buildMultiFilter(almacenProductos.categoria_id, f.categoria_id);
    if (cCat) conditions.push(cCat);
    if (f.activo !== undefined) conditions.push(eq(almacenProductos.activo, f.activo));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(almacenProductos).where(where);
    const rows = await db
      .select({
        producto: almacenProductos,
        categoria_nombre: almacenCategorias.nombre,
        unidad_codigo: almacenUnidadesMedida.codigo,
        unidad_nombre: almacenUnidadesMedida.nombre,
      })
      .from(almacenProductos)
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .leftJoin(almacenCategorias, eq(almacenProductos.categoria_id, almacenCategorias.id))
      .where(where)
      .orderBy(asc(almacenProductos.nombre))
      .limit(f.limit)
      .offset((f.page - 1) * f.limit);

    return {
      items: rows.map((r) => ({
        ...r.producto,
        categoria_nombre: r.categoria_nombre,
        unidad_codigo: r.unidad_codigo,
        unidad_nombre: r.unidad_nombre,
        unidad_medida_codigo: r.unidad_codigo,
        unidad_medida_nombre: r.unidad_nombre,
      })),
      total,
      page: f.page,
      limit: f.limit,
      totalPages: Math.ceil(total / f.limit),
    };
  }

  async obtener(id: number): Promise<AlmacenProducto> {
    const [row] = await db.select().from(almacenProductos).where(eq(almacenProductos.id, id));
    if (!row) throw new AlmacenError('Producto no encontrado', 404);
    return row;
  }

  async crear(data: CrearProductoInput, usuarioId: number): Promise<AlmacenProducto> {
    this.validarReglas(data);
    const codigo = data.codigo ? data.codigo.toUpperCase() : null;
    if (codigo) {
      const [dup] = await db
        .select({ id: almacenProductos.id })
        .from(almacenProductos)
        .where(eq(almacenProductos.codigo, codigo));
      if (dup) throw new AlmacenError(`Ya existe un producto con el código "${codigo}"`, 409);
    }
    const [row] = await db
      .insert(almacenProductos)
      .values({
        ...data,
        codigo,
        stock_minimo: data.stock_minimo ?? 0,
        controla_lote: data.controla_lote ?? false,
        controla_vencimiento: data.controla_vencimiento ?? false,
        requiere_cadena_frio: data.requiere_cadena_frio ?? false,
        dias_alerta_vencimiento: data.dias_alerta_vencimiento ?? 30,
        usuario_registro_id: usuarioId,
      })
      .returning();
    return row;
  }

  async actualizar(id: number, data: ActualizarProductoInput): Promise<AlmacenProducto> {
    const actual = await this.obtener(id);
    this.validarReglas({ ...actual, ...data });
    const [row] = await db
      .update(almacenProductos)
      .set({
        ...data,
        codigo: data.codigo === undefined ? undefined : data.codigo?.toUpperCase() ?? null,
      })
      .where(eq(almacenProductos.id, id))
      .returning();
    return row;
  }

  /** Maestros: siempre baja lógica (conserva el historial y las FKs). */
  async desactivar(id: number): Promise<AlmacenProducto> {
    const [row] = await db
      .update(almacenProductos)
      .set({ activo: false })
      .where(eq(almacenProductos.id, id))
      .returning();
    if (!row) throw new AlmacenError('Producto no encontrado', 404);
    return row;
  }

  private validarReglas(p: {
    requiere_cadena_frio?: boolean | null;
    temp_min?: number | null;
    temp_max?: number | null;
  }) {
    if (p.requiere_cadena_frio && (p.temp_min == null || p.temp_max == null)) {
      throw new AlmacenError('Un producto con cadena de frío requiere temperatura mínima y máxima', 400);
    }
    if (p.temp_min != null && p.temp_max != null && p.temp_min > p.temp_max) {
      throw new AlmacenError('La temperatura mínima no puede superar a la máxima', 400);
    }
  }
}

export const almacenProductosService = new AlmacenProductosService();
