import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  db,
  almacenIngresos,
  almacenIngresoDetalle,
  almacenAlmacenes,
  almacenProveedores,
  almacenLotes,
  almacenProductos,
  almacenUbicaciones,
  almacenUnidadesMedida,
  almacenStock,
  almacenMovimientos,
  almacenOrdenesCompra,
  almacenOrdenCompraDetalle,
  usuarios,
  sedes,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { obtenerSiguienteCorrelativo } from '../shared/almacen.correlativo';
import { resolverOCrearLote } from '../shared/almacen.lotes';
import { buildMultiFilter } from '../shared/almacen.filters';
import type { Paginado } from '../shared/almacen.types';
import type {
  CrearIngresoInput,
  AnularIngresoInput,
  ListarIngresosQuery,
} from './ingresos.schema';
import type { AlmacenIngresoCompleto } from './ingresos.types';

export class AlmacenIngresosService {
  async listar(
    f: ListarIngresosQuery,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenIngresoCompleto>> {
    const conditions: (SQL | undefined)[] = [];

    if (f.almacen_id) conditions.push(buildMultiFilter(almacenIngresos.almacen_id, f.almacen_id));
    if (f.proveedor_id) conditions.push(buildMultiFilter(almacenIngresos.proveedor_id, f.proveedor_id));
    if (f.estado) conditions.push(buildMultiFilter(almacenIngresos.estado, f.estado));
    if (f.fecha_desde) conditions.push(gte(almacenIngresos.fecha_ingreso, f.fecha_desde));
    if (f.fecha_hasta) conditions.push(lte(almacenIngresos.fecha_ingreso, f.fecha_hasta));

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
          ilike(almacenIngresos.numero, s),
          ilike(almacenIngresos.numero_documento, s),
          ilike(almacenProveedores.razon_social, s)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenIngresos)
      .innerJoin(almacenAlmacenes, eq(almacenIngresos.almacen_id, almacenAlmacenes.id))
      .leftJoin(almacenProveedores, eq(almacenIngresos.proveedor_id, almacenProveedores.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenIngresos.id,
        numero: almacenIngresos.numero,
        almacen_id: almacenIngresos.almacen_id,
        proveedor_id: almacenIngresos.proveedor_id,
        orden_compra_id: almacenIngresos.orden_compra_id,
        tipo_documento: almacenIngresos.tipo_documento,
        serie_documento: almacenIngresos.serie_documento,
        numero_documento: almacenIngresos.numero_documento,
        fecha_documento: almacenIngresos.fecha_documento,
        fecha_ingreso: almacenIngresos.fecha_ingreso,
        moneda: almacenIngresos.moneda,
        observaciones: almacenIngresos.observaciones,
        adjunto_url: almacenIngresos.adjunto_url,
        estado: almacenIngresos.estado,
        motivo_anulacion: almacenIngresos.motivo_anulacion,
        usuario_registro_id: almacenIngresos.usuario_registro_id,
        usuario_anulacion_id: almacenIngresos.usuario_anulacion_id,
        fecha_anulacion: almacenIngresos.fecha_anulacion,
        legacy_id: almacenIngresos.legacy_id,
        created_at: almacenIngresos.created_at,
        updated_at: almacenIngresos.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        proveedor_razon_social: almacenProveedores.razon_social,
        proveedor_ruc: almacenProveedores.ruc,
        usuario_registro_nombre: usuarios.username,
        correlativo: almacenIngresos.numero,
        total_items: sql<number>`coalesce((SELECT count(*)::int FROM ${almacenIngresoDetalle} WHERE ${almacenIngresoDetalle.ingreso_id} = ${almacenIngresos.id}), 0)`,
        monto_total: sql<number>`coalesce((SELECT sum(${almacenIngresoDetalle.cantidad} * ${almacenIngresoDetalle.costo_unitario})::numeric FROM ${almacenIngresoDetalle} WHERE ${almacenIngresoDetalle.ingreso_id} = ${almacenIngresos.id}), 0)`,
      })
      .from(almacenIngresos)
      .innerJoin(almacenAlmacenes, eq(almacenIngresos.almacen_id, almacenAlmacenes.id))
      .leftJoin(almacenProveedores, eq(almacenIngresos.proveedor_id, almacenProveedores.id))
      .leftJoin(usuarios, eq(almacenIngresos.usuario_registro_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenIngresos.id))
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

  async obtener(id: number, sedesPermitidas?: number[]): Promise<AlmacenIngresoCompleto> {
    const [cab] = await db
      .select({
        id: almacenIngresos.id,
        numero: almacenIngresos.numero,
        almacen_id: almacenIngresos.almacen_id,
        proveedor_id: almacenIngresos.proveedor_id,
        orden_compra_id: almacenIngresos.orden_compra_id,
        tipo_documento: almacenIngresos.tipo_documento,
        serie_documento: almacenIngresos.serie_documento,
        numero_documento: almacenIngresos.numero_documento,
        fecha_documento: almacenIngresos.fecha_documento,
        fecha_ingreso: almacenIngresos.fecha_ingreso,
        moneda: almacenIngresos.moneda,
        observaciones: almacenIngresos.observaciones,
        adjunto_url: almacenIngresos.adjunto_url,
        estado: almacenIngresos.estado,
        motivo_anulacion: almacenIngresos.motivo_anulacion,
        usuario_registro_id: almacenIngresos.usuario_registro_id,
        usuario_anulacion_id: almacenIngresos.usuario_anulacion_id,
        fecha_anulacion: almacenIngresos.fecha_anulacion,
        legacy_id: almacenIngresos.legacy_id,
        created_at: almacenIngresos.created_at,
        updated_at: almacenIngresos.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        sede_nombre: sedes.nombre,
        proveedor_razon_social: almacenProveedores.razon_social,
        proveedor_ruc: almacenProveedores.ruc,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenIngresos)
      .innerJoin(almacenAlmacenes, eq(almacenIngresos.almacen_id, almacenAlmacenes.id))
      .leftJoin(sedes, eq(almacenAlmacenes.sede_id, sedes.id))
      .leftJoin(almacenProveedores, eq(almacenIngresos.proveedor_id, almacenProveedores.id))
      .leftJoin(usuarios, eq(almacenIngresos.usuario_registro_id, usuarios.id))
      .where(eq(almacenIngresos.id, id));

    if (!cab) throw new AlmacenError('Ingreso no encontrado', 404);

    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(cab.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede de este ingreso', 403);
    }

    // Cargar detalles
    const items = await db
      .select({
        id: almacenIngresoDetalle.id,
        ingreso_id: almacenIngresoDetalle.ingreso_id,
        producto_id: almacenIngresoDetalle.producto_id,
        lote_id: almacenIngresoDetalle.lote_id,
        ubicacion_id: almacenIngresoDetalle.ubicacion_id,
        orden_compra_detalle_id: almacenIngresoDetalle.orden_compra_detalle_id,
        cantidad: almacenIngresoDetalle.cantidad,
        costo_unitario: almacenIngresoDetalle.costo_unitario,
        legacy_id: almacenIngresoDetalle.legacy_id,
        created_at: almacenIngresoDetalle.created_at,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        numero_lote: almacenLotes.numero_lote,
        marca: almacenLotes.marca,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
        ubicacion_codigo: almacenUbicaciones.codigo,
        ubicacion_nombre: almacenUbicaciones.nombre,
      })
      .from(almacenIngresoDetalle)
      .innerJoin(almacenProductos, eq(almacenIngresoDetalle.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .innerJoin(almacenLotes, eq(almacenIngresoDetalle.lote_id, almacenLotes.id))
      .leftJoin(almacenUbicaciones, eq(almacenIngresoDetalle.ubicacion_id, almacenUbicaciones.id))
      .where(eq(almacenIngresoDetalle.ingreso_id, id));

    return { ...cab, items };
  }

  async crear(
    data: CrearIngresoInput,
    usuarioId: number,
    sedesPermitidas?: number[]
  ): Promise<AlmacenIngresoCompleto> {
    // Validar almacén
    const [alm] = await db
      .select({ id: almacenAlmacenes.id, sede_id: almacenAlmacenes.sede_id, activo: almacenAlmacenes.activo })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, data.almacen_id));

    if (!alm) throw new AlmacenError('Almacén no encontrado', 404);
    if (!alm.activo) throw new AlmacenError('El almacén seleccionado está inactivo', 400);

    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(alm.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede de este almacén', 403);
    }

    // Transacción atómica
    const ingresoCreado = await db.transaction(async (tx) => {
      // 1. Obtener correlativo de negocio
      const numero = await obtenerSiguienteCorrelativo(tx, 'ING', alm.sede_id, data.fecha_ingreso);

      // 2. Insertar cabecera
      const [ingreso] = await tx
        .insert(almacenIngresos)
        .values({
          numero,
          almacen_id: data.almacen_id,
          proveedor_id: data.proveedor_id ?? null,
          orden_compra_id: data.orden_compra_id ?? null,
          tipo_documento: data.tipo_documento,
          serie_documento: data.serie_documento?.trim() || null,
          numero_documento: data.numero_documento?.trim() || null,
          fecha_documento: data.fecha_documento || null,
          fecha_ingreso: data.fecha_ingreso,
          moneda: data.moneda,
          observaciones: data.observaciones?.trim() || null,
          usuario_registro_id: usuarioId,
          estado: 'REGISTRADO',
        })
        .returning();

      // 3. Resolver lotes de cada ítem
      const lineasConLote = [];
      for (const item of data.items) {
        const loteId = await resolverOCrearLote(tx, item.producto_id, {
          numero_lote: item.numero_lote,
          marca: item.marca,
          fecha_vencimiento: item.fecha_vencimiento,
          fecha_fabricacion: item.fecha_fabricacion,
        });
        lineasConLote.push({ ...item, loteId });
      }

      // 4. Insertar detalles
      for (const l of lineasConLote) {
        const [det] = await tx
          .insert(almacenIngresoDetalle)
          .values({
            ingreso_id: ingreso.id,
            producto_id: l.producto_id,
            lote_id: l.loteId,
            ubicacion_id: l.ubicacion_id ?? null,
            orden_compra_detalle_id: l.orden_compra_detalle_id ?? null,
            cantidad: l.cantidad,
            costo_unitario: l.costo_unitario,
          })
          .returning();

        // 4.1 Si viene de una Orden de Compra, sumar a la cantidad recibida
        if (l.orden_compra_detalle_id) {
          await tx
            .update(almacenOrdenCompraDetalle)
            .set({
              cantidad_recibida: sql`${almacenOrdenCompraDetalle.cantidad_recibida} + ${l.cantidad}`,
            })
            .where(eq(almacenOrdenCompraDetalle.id, l.orden_compra_detalle_id));
        }

        // 5. Upsert de saldo en almacen.stock
        await tx
          .insert(almacenStock)
          .values({
            almacen_id: data.almacen_id,
            producto_id: l.producto_id,
            lote_id: l.loteId,
            ubicacion_id: l.ubicacion_id ?? null,
            cantidad: l.cantidad,
          })
          .onConflictDoUpdate({
            target: [almacenStock.almacen_id, almacenStock.lote_id],
            set: {
              cantidad: sql`${almacenStock.cantidad} + ${l.cantidad}`,
              ubicacion_id: sql`COALESCE(${l.ubicacion_id ?? null}, ${almacenStock.ubicacion_id})`,
              updated_at: sql`CURRENT_TIMESTAMP`,
            },
          });

        // 6. Registrar movimiento en kardex
        await tx.insert(almacenMovimientos).values({
          tipo: 'INGRESO',
          sede_id: alm.sede_id,
          almacen_id: data.almacen_id,
          producto_id: l.producto_id,
          lote_id: l.loteId,
          ubicacion_id: l.ubicacion_id ?? null,
          cantidad: l.cantidad,
          costo_unitario: l.costo_unitario,
          documento_tipo: 'INGRESO',
          documento_id: ingreso.id,
          documento_detalle_id: det.id,
          usuario_id: usuarioId,
        });
      }

      // 7. Si está vinculado a una Orden de Compra, actualizar el estado de la OC
      if (data.orden_compra_id) {
        const ocItems = await tx
          .select({
            solicitada: almacenOrdenCompraDetalle.cantidad_solicitada,
            recibida: almacenOrdenCompraDetalle.cantidad_recibida,
          })
          .from(almacenOrdenCompraDetalle)
          .where(eq(almacenOrdenCompraDetalle.orden_compra_id, data.orden_compra_id));

        const allCompleted = ocItems.length > 0 && ocItems.every((it) => Number(it.recibida) >= Number(it.solicitada));
        const anyReceived = ocItems.some((it) => Number(it.recibida) > 0);
        const nuevoEstado = allCompleted ? 'RECEPCIONADA' : anyReceived ? 'PARCIAL' : 'PENDIENTE';

        await tx
          .update(almacenOrdenesCompra)
          .set({
            estado: nuevoEstado,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(almacenOrdenesCompra.id, data.orden_compra_id));
      }

      return ingreso;
    });

    return this.obtener(ingresoCreado.id, sedesPermitidas);
  }

  async anular(
    id: number,
    data: AnularIngresoInput,
    usuarioId: number,
    sedesPermitidas?: number[]
  ): Promise<AlmacenIngresoCompleto> {
    const actual = await this.obtener(id, sedesPermitidas);

    if (actual.estado === 'ANULADO') {
      throw new AlmacenError('El ingreso ya se encuentra anulado', 400);
    }

    if (!actual.items || actual.items.length === 0) {
      throw new AlmacenError('El ingreso no tiene detalles para anular', 400);
    }

    await db.transaction(async (tx) => {
      // 1. Revertir stock de cada línea comprobando que haya saldo suficiente
      for (const item of actual.items!) {
        const [reducido] = await tx
          .update(almacenStock)
          .set({
            cantidad: sql`${almacenStock.cantidad} - ${item.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(almacenStock.almacen_id, actual.almacen_id),
              eq(almacenStock.lote_id, item.lote_id),
              sql`${almacenStock.cantidad} >= ${item.cantidad}`
            )
          )
          .returning({ id: almacenStock.id });

        if (!reducido) {
          throw new AlmacenError(
            `Stock insuficiente en almacén para anular el ingreso del producto "${item.producto_nombre}". El material ya fue consumido o despachado`,
            409,
            'STOCK_INSUFICIENTE'
          );
        }

        // Buscar el movimiento original del kardex
        const [movOriginal] = await tx
          .select({ id: almacenMovimientos.id })
          .from(almacenMovimientos)
          .where(
            and(
              eq(almacenMovimientos.documento_tipo, 'INGRESO'),
              eq(almacenMovimientos.documento_id, id),
              eq(almacenMovimientos.documento_detalle_id, item.id)
            )
          );

        // Registrar movimiento de anulación en kardex
        await tx.insert(almacenMovimientos).values({
          tipo: 'ANULACION',
          sede_id: actual.sede_id!,
          almacen_id: actual.almacen_id,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario,
          documento_tipo: 'INGRESO',
          documento_id: id,
          documento_detalle_id: item.id,
          anula_movimiento_id: movOriginal?.id ?? null,
          observacion: `Anulación: ${data.motivo.trim()}`,
          usuario_id: usuarioId,
        });

        // Revertir cantidad_recibida si provenía de una Orden de Compra
        if (item.orden_compra_detalle_id) {
          await tx
            .update(almacenOrdenCompraDetalle)
            .set({
              cantidad_recibida: sql`GREATEST(0, ${almacenOrdenCompraDetalle.cantidad_recibida} - ${item.cantidad})`,
            })
            .where(eq(almacenOrdenCompraDetalle.id, item.orden_compra_detalle_id));
        }
      }

      // 2. Marcar ingreso como ANULADO
      await tx
        .update(almacenIngresos)
        .set({
          estado: 'ANULADO',
          motivo_anulacion: data.motivo.trim(),
          usuario_anulacion_id: usuarioId,
          fecha_anulacion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenIngresos.id, id));

      // 3. Re-evaluar estado de la Orden de Compra si existía
      if (actual.orden_compra_id) {
        const ocItems = await tx
          .select({
            solicitada: almacenOrdenCompraDetalle.cantidad_solicitada,
            recibida: almacenOrdenCompraDetalle.cantidad_recibida,
          })
          .from(almacenOrdenCompraDetalle)
          .where(eq(almacenOrdenCompraDetalle.orden_compra_id, actual.orden_compra_id));

        const allCompleted = ocItems.length > 0 && ocItems.every((it) => Number(it.recibida) >= Number(it.solicitada));
        const anyReceived = ocItems.some((it) => Number(it.recibida) > 0);
        const nuevoEstado = allCompleted ? 'RECEPCIONADA' : anyReceived ? 'PARCIAL' : 'PENDIENTE';

        await tx
          .update(almacenOrdenesCompra)
          .set({
            estado: nuevoEstado,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(almacenOrdenesCompra.id, actual.orden_compra_id));
      }
    });

    return this.obtener(id, sedesPermitidas);
  }
}

export const almacenIngresosService = new AlmacenIngresosService();
