import { and, asc, count, desc, eq, gt, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  db,
  almacenStock,
  almacenMovimientos,
  almacenAlmacenes,
  almacenUbicaciones,
  almacenProductos,
  almacenCategorias,
  almacenUnidadesMedida,
  almacenLotes,
  sedes,
  usuarios,
  personal,
} from '../../../db';
import { buildMultiFilter } from '../shared/almacen.filters';
import type { Paginado } from '../shared/almacen.types';
import type { ListarStockQuery, ListarKardexQuery } from './stock.schema';
import type { StockItem, KardexItem } from './stock.types';

export class AlmacenStockService {
  // ==========================================
  // CONSULTA DE STOCK
  // ==========================================
  async listarStock(
    f: ListarStockQuery,
    sedesPermitidas?: number[]
  ): Promise<Paginado<StockItem>> {
    const conditions: (SQL | undefined)[] = [];

    if (f.con_saldo) {
      conditions.push(gt(almacenStock.cantidad, 0));
    }
    const cAlmacen = buildMultiFilter(almacenStock.almacen_id, f.almacen_id);
    if (cAlmacen) conditions.push(cAlmacen);
    if (f.producto_id) {
      conditions.push(eq(almacenStock.producto_id, f.producto_id));
    }
    if (f.sede_id) {
      conditions.push(eq(almacenAlmacenes.sede_id, f.sede_id));
    }
    const cCategoria = buildMultiFilter(almacenProductos.categoria_id, f.categoria_id);
    if (cCategoria) conditions.push(cCategoria);
    if (f.ubicacion_id) {
      conditions.push(eq(almacenStock.ubicacion_id, f.ubicacion_id));
    }

    if (sedesPermitidas !== undefined) {
      if (sedesPermitidas.length === 0) {
        return { items: [], total: 0, page: f.page, limit: f.limit, totalPages: 0 };
      }
      conditions.push(inArray(almacenAlmacenes.sede_id, sedesPermitidas));
    }

    if (f.search) {
      const s = `%${f.search}%`;
      conditions.push(
        or(
          ilike(almacenProductos.nombre, s),
          ilike(almacenProductos.codigo, s),
          ilike(almacenLotes.numero_lote, s),
          ilike(almacenLotes.marca, s)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const modoAgrupacion = f.agrupar_por || (f.desglosar_lote ? 'lote' : 'producto');

    if (modoAgrupacion === 'lote') {
      // Listado detallado fila por lote físico
      const [{ total }] = await db
        .select({ total: count() })
        .from(almacenStock)
        .innerJoin(almacenAlmacenes, eq(almacenStock.almacen_id, almacenAlmacenes.id))
        .innerJoin(almacenProductos, eq(almacenStock.producto_id, almacenProductos.id))
        .innerJoin(almacenLotes, eq(almacenStock.lote_id, almacenLotes.id))
        .leftJoin(almacenUbicaciones, eq(almacenStock.ubicacion_id, almacenUbicaciones.id))
        .where(where);

      const items = await db
        .select({
          id: almacenStock.id,
          almacen_id: almacenStock.almacen_id,
          almacen_nombre: almacenAlmacenes.nombre,
          sede_id: almacenAlmacenes.sede_id,
          sede_nombre: sedes.nombre,
          producto_id: almacenStock.producto_id,
          producto_codigo: almacenProductos.codigo,
          producto_nombre: almacenProductos.nombre,
          categoria_nombre: almacenCategorias.nombre,
          unidad_medida_codigo: almacenUnidadesMedida.codigo,
          stock_minimo: almacenProductos.stock_minimo,
          lote_id: almacenStock.lote_id,
          numero_lote: almacenLotes.numero_lote,
          marca: almacenLotes.marca,
          fecha_vencimiento: almacenLotes.fecha_vencimiento,
          ubicacion_id: almacenStock.ubicacion_id,
          ubicacion_codigo: almacenUbicaciones.codigo,
          ubicacion_nombre: almacenUbicaciones.nombre,
          cantidad: almacenStock.cantidad,
        })
        .from(almacenStock)
        .innerJoin(almacenAlmacenes, eq(almacenStock.almacen_id, almacenAlmacenes.id))
        .innerJoin(sedes, eq(almacenAlmacenes.sede_id, sedes.id))
        .innerJoin(almacenProductos, eq(almacenStock.producto_id, almacenProductos.id))
        .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
        .leftJoin(almacenCategorias, eq(almacenProductos.categoria_id, almacenCategorias.id))
        .innerJoin(almacenLotes, eq(almacenStock.lote_id, almacenLotes.id))
        .leftJoin(almacenUbicaciones, eq(almacenStock.ubicacion_id, almacenUbicaciones.id))
        .where(where)
        .orderBy(asc(almacenProductos.nombre), asc(almacenLotes.fecha_vencimiento))
        .limit(f.limit)
        .offset((f.page - 1) * f.limit);

      return {
        items,
        total,
        page: f.page,
        limit: f.limit,
        totalPages: Math.ceil(total / f.limit),
      };
    } else if (modoAgrupacion === 'marca') {
      // Listado agrupado por Producto + Marca
      const queryMarca = db
        .select({
          almacen_id: almacenStock.almacen_id,
          almacen_nombre: almacenAlmacenes.nombre,
          sede_id: almacenAlmacenes.sede_id,
          sede_nombre: sedes.nombre,
          producto_id: almacenStock.producto_id,
          producto_codigo: almacenProductos.codigo,
          producto_nombre: almacenProductos.nombre,
          categoria_nombre: almacenCategorias.nombre,
          unidad_medida_codigo: almacenUnidadesMedida.codigo,
          stock_minimo: almacenProductos.stock_minimo,
          marca: sql<string>`COALESCE(${almacenLotes.marca}, 'Sin Marca')`,
          cantidad: sql<number>`SUM(${almacenStock.cantidad})::float`,
          total_lotes: sql<number>`COUNT(DISTINCT ${almacenStock.lote_id})::int`,
          proximo_vencimiento: sql<string | null>`MIN(${almacenLotes.fecha_vencimiento})`,
          ubicaciones_str: sql<string | null>`STRING_AGG(DISTINCT ${almacenUbicaciones.codigo}, ', ')`,
        })
        .from(almacenStock)
        .innerJoin(almacenAlmacenes, eq(almacenStock.almacen_id, almacenAlmacenes.id))
        .innerJoin(sedes, eq(almacenAlmacenes.sede_id, sedes.id))
        .innerJoin(almacenProductos, eq(almacenStock.producto_id, almacenProductos.id))
        .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
        .leftJoin(almacenCategorias, eq(almacenProductos.categoria_id, almacenCategorias.id))
        .innerJoin(almacenLotes, eq(almacenStock.lote_id, almacenLotes.id))
        .leftJoin(almacenUbicaciones, eq(almacenStock.ubicacion_id, almacenUbicaciones.id))
        .where(where)
        .groupBy(
          almacenStock.almacen_id,
          almacenAlmacenes.nombre,
          almacenAlmacenes.sede_id,
          sedes.nombre,
          almacenStock.producto_id,
          almacenProductos.codigo,
          almacenProductos.nombre,
          almacenCategorias.nombre,
          almacenUnidadesMedida.codigo,
          almacenProductos.stock_minimo,
          sql`COALESCE(${almacenLotes.marca}, 'Sin Marca')`
        )
        .orderBy(asc(almacenProductos.nombre), sql`COALESCE(${almacenLotes.marca}, 'Sin Marca')`);

      const rows = await queryMarca;
      const total = rows.length;
      const paginated = rows.slice((f.page - 1) * f.limit, f.page * f.limit);

      return {
        items: paginated,
        total,
        page: f.page,
        limit: f.limit,
        totalPages: Math.ceil(total / f.limit),
      };
    } else {
      // Listado consolidado general por producto y almacén
      const queryGroup = db
        .select({
          almacen_id: almacenStock.almacen_id,
          almacen_nombre: almacenAlmacenes.nombre,
          sede_id: almacenAlmacenes.sede_id,
          sede_nombre: sedes.nombre,
          producto_id: almacenStock.producto_id,
          producto_codigo: almacenProductos.codigo,
          producto_nombre: almacenProductos.nombre,
          categoria_nombre: almacenCategorias.nombre,
          unidad_medida_codigo: almacenUnidadesMedida.codigo,
          stock_minimo: almacenProductos.stock_minimo,
          cantidad: sql<number>`SUM(${almacenStock.cantidad})::float`,
          total_lotes: sql<number>`COUNT(DISTINCT ${almacenStock.lote_id})::int`,
          proximo_vencimiento: sql<string | null>`MIN(${almacenLotes.fecha_vencimiento})`,
          ubicaciones_str: sql<string | null>`STRING_AGG(DISTINCT ${almacenUbicaciones.codigo}, ', ')`,
        })
        .from(almacenStock)
        .innerJoin(almacenAlmacenes, eq(almacenStock.almacen_id, almacenAlmacenes.id))
        .innerJoin(sedes, eq(almacenAlmacenes.sede_id, sedes.id))
        .innerJoin(almacenProductos, eq(almacenStock.producto_id, almacenProductos.id))
        .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
        .leftJoin(almacenCategorias, eq(almacenProductos.categoria_id, almacenCategorias.id))
        .innerJoin(almacenLotes, eq(almacenStock.lote_id, almacenLotes.id))
        .leftJoin(almacenUbicaciones, eq(almacenStock.ubicacion_id, almacenUbicaciones.id))
        .where(where)
        .groupBy(
          almacenStock.almacen_id,
          almacenAlmacenes.nombre,
          almacenAlmacenes.sede_id,
          sedes.nombre,
          almacenStock.producto_id,
          almacenProductos.codigo,
          almacenProductos.nombre,
          almacenCategorias.nombre,
          almacenUnidadesMedida.codigo,
          almacenProductos.stock_minimo
        )
        .orderBy(asc(almacenProductos.nombre));

      const rows = await queryGroup;
      const total = rows.length;
      const paginated = rows.slice((f.page - 1) * f.limit, f.page * f.limit);

      return {
        items: paginated,
        total,
        page: f.page,
        limit: f.limit,
        totalPages: Math.ceil(total / f.limit),
      };
    }
  }

  // ==========================================
  // CONSULTA DE KARDEX
  // ==========================================
  async listarKardex(
    f: ListarKardexQuery,
    sedesPermitidas?: number[]
  ): Promise<Paginado<KardexItem>> {
    const conditions: (SQL | undefined)[] = [];

    const cAlmacen = buildMultiFilter(almacenMovimientos.almacen_id, f.almacen_id);
    if (cAlmacen) conditions.push(cAlmacen);
    if (f.producto_id) conditions.push(eq(almacenMovimientos.producto_id, f.producto_id));
    if (f.lote_id) conditions.push(eq(almacenMovimientos.lote_id, f.lote_id));
    if (f.ubicacion_id) conditions.push(eq(almacenMovimientos.ubicacion_id, f.ubicacion_id));
    const cTipo = buildMultiFilter(almacenMovimientos.tipo, f.tipo);
    if (cTipo) conditions.push(cTipo);
    if (f.fecha_desde) conditions.push(gte(almacenMovimientos.fecha, `${f.fecha_desde} 00:00:00`));
    if (f.fecha_hasta) conditions.push(lte(almacenMovimientos.fecha, `${f.fecha_hasta} 23:59:59`));

    if (sedesPermitidas !== undefined) {
      if (sedesPermitidas.length === 0) {
        return { items: [], total: 0, page: f.page, limit: f.limit, totalPages: 0 };
      }
      conditions.push(inArray(almacenMovimientos.sede_id, sedesPermitidas));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenMovimientos)
      .where(where);

    const rows = await db
      .select({
        id: almacenMovimientos.id,
        tipo: almacenMovimientos.tipo,
        fecha: almacenMovimientos.fecha,
        sede_id: almacenMovimientos.sede_id,
        sede_nombre: sedes.nombre,
        almacen_id: almacenMovimientos.almacen_id,
        almacen_nombre: almacenAlmacenes.nombre,
        personal_id: almacenMovimientos.personal_id,
        personal_nombre: sql<string | null>`CONCAT(${personal.nombres}, ' ', ${personal.apellidos})`,
        producto_id: almacenMovimientos.producto_id,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        lote_id: almacenMovimientos.lote_id,
        numero_lote: almacenLotes.numero_lote,
        ubicacion_id: almacenMovimientos.ubicacion_id,
        ubicacion_codigo: almacenUbicaciones.codigo,
        ubicacion_nombre: almacenUbicaciones.nombre,
        cantidad: almacenMovimientos.cantidad,
        costo_unitario: almacenMovimientos.costo_unitario,
        documento_tipo: almacenMovimientos.documento_tipo,
        documento_id: almacenMovimientos.documento_id,
        observacion: almacenMovimientos.observacion,
        usuario_nombre: usuarios.username,
      })
      .from(almacenMovimientos)
      .innerJoin(sedes, eq(almacenMovimientos.sede_id, sedes.id))
      .leftJoin(almacenAlmacenes, eq(almacenMovimientos.almacen_id, almacenAlmacenes.id))
      .leftJoin(personal, eq(almacenMovimientos.personal_id, personal.id))
      .innerJoin(almacenProductos, eq(almacenMovimientos.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .innerJoin(almacenLotes, eq(almacenMovimientos.lote_id, almacenLotes.id))
      .leftJoin(almacenUbicaciones, eq(almacenMovimientos.ubicacion_id, almacenUbicaciones.id))
      .innerJoin(usuarios, eq(almacenMovimientos.usuario_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenMovimientos.id))
      .limit(f.limit)
      .offset((f.page - 1) * f.limit);

    return {
      items: rows,
      total,
      page: f.page,
      limit: f.limit,
      totalPages: Math.ceil(total / f.limit),
    };
  }
}

export const almacenStockService = new AlmacenStockService();
