import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  db,
  almacenOrdenesCompra,
  almacenOrdenCompraDetalle,
  almacenProveedores,
  almacenAlmacenes,
  almacenProductos,
  almacenUnidadesMedida,
  almacenIngresos,
  usuarios,
  sedes,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { obtenerSiguienteCorrelativo } from '../shared/almacen.correlativo';
import { buildMultiFilter } from '../shared/almacen.filters';
import type { Paginado } from '../shared/almacen.types';
import type {
  CrearOrdenCompraInput,
  AnularOrdenCompraInput,
  ListarOrdenesCompraQuery,
} from './ordenes-compra.schema';
import type { AlmacenOrdenCompraCompleta } from './ordenes-compra.types';

export class AlmacenOrdenesCompraService {
  async listar(
    f: ListarOrdenesCompraQuery,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenOrdenCompraCompleta>> {
    const conditions: (SQL | undefined)[] = [];

    if (f.sede_id) conditions.push(buildMultiFilter(almacenOrdenesCompra.sede_id, f.sede_id));
    if (f.proveedor_id) conditions.push(buildMultiFilter(almacenOrdenesCompra.proveedor_id, f.proveedor_id));
    if (f.almacen_destino_id) conditions.push(buildMultiFilter(almacenOrdenesCompra.almacen_destino_id, f.almacen_destino_id));
    if (f.estado) conditions.push(buildMultiFilter(almacenOrdenesCompra.estado, f.estado));
    if (f.fecha_desde) conditions.push(gte(almacenOrdenesCompra.fecha_emision, f.fecha_desde));
    if (f.fecha_hasta) conditions.push(lte(almacenOrdenesCompra.fecha_emision, f.fecha_hasta));

    if (sedesPermitidas !== undefined) {
      if (sedesPermitidas.length === 0) {
        return { items: [], total: 0, page: f.page, limit: f.limit, totalPages: 0 };
      }
      conditions.push(inArray(almacenOrdenesCompra.sede_id, sedesPermitidas));
    }

    if (f.search) {
      const s = `%${f.search}%`;
      conditions.push(
        or(
          ilike(almacenOrdenesCompra.numero, s),
          ilike(almacenProveedores.razon_social, s),
          ilike(almacenProveedores.ruc, s),
          sql`EXISTS (
            SELECT 1 FROM ${almacenOrdenCompraDetalle}
            INNER JOIN ${almacenProductos} ON ${almacenOrdenCompraDetalle.producto_id} = ${almacenProductos.id}
            WHERE ${almacenOrdenCompraDetalle.orden_compra_id} = ${almacenOrdenesCompra.id}
            AND (${almacenProductos.nombre} ILIKE ${s} OR ${almacenProductos.codigo} ILIKE ${s})
          )`
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenOrdenesCompra)
      .innerJoin(almacenProveedores, eq(almacenOrdenesCompra.proveedor_id, almacenProveedores.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenOrdenesCompra.id,
        numero: almacenOrdenesCompra.numero,
        sede_id: almacenOrdenesCompra.sede_id,
        proveedor_id: almacenOrdenesCompra.proveedor_id,
        almacen_destino_id: almacenOrdenesCompra.almacen_destino_id,
        fecha_emision: almacenOrdenesCompra.fecha_emision,
        fecha_entrega_esperada: almacenOrdenesCompra.fecha_entrega_esperada,
        moneda: almacenOrdenesCompra.moneda,
        condicion_pago: almacenOrdenesCompra.condicion_pago,
        estado: almacenOrdenesCompra.estado,
        subtotal: almacenOrdenesCompra.subtotal,
        igv: almacenOrdenesCompra.igv,
        total: almacenOrdenesCompra.total,
        observaciones: almacenOrdenesCompra.observaciones,
        motivo_anulacion: almacenOrdenesCompra.motivo_anulacion,
        usuario_registro_id: almacenOrdenesCompra.usuario_registro_id,
        usuario_anulacion_id: almacenOrdenesCompra.usuario_anulacion_id,
        fecha_anulacion: almacenOrdenesCompra.fecha_anulacion,
        created_at: almacenOrdenesCompra.created_at,
        updated_at: almacenOrdenesCompra.updated_at,
        sede_nombre: sedes.nombre,
        proveedor_razon_social: almacenProveedores.razon_social,
        proveedor_ruc: almacenProveedores.ruc,
        almacen_destino_nombre: almacenAlmacenes.nombre,
        usuario_registro_nombre: usuarios.username,
        total_items: sql<number>`coalesce((SELECT count(*)::int FROM ${almacenOrdenCompraDetalle} WHERE ${almacenOrdenCompraDetalle.orden_compra_id} = ${almacenOrdenesCompra.id}), 0)`,
      })
      .from(almacenOrdenesCompra)
      .innerJoin(sedes, eq(almacenOrdenesCompra.sede_id, sedes.id))
      .innerJoin(almacenProveedores, eq(almacenOrdenesCompra.proveedor_id, almacenProveedores.id))
      .leftJoin(almacenAlmacenes, eq(almacenOrdenesCompra.almacen_destino_id, almacenAlmacenes.id))
      .leftJoin(usuarios, eq(almacenOrdenesCompra.usuario_registro_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenOrdenesCompra.id))
      .limit(f.limit)
      .offset((f.page - 1) * f.limit);

    return {
      items: rows as AlmacenOrdenCompraCompleta[],
      total,
      page: f.page,
      limit: f.limit,
      totalPages: Math.ceil(total / f.limit) || 0,
    };
  }

  async obtenerPorId(
    id: number,
    sedesPermitidas?: number[]
  ): Promise<AlmacenOrdenCompraCompleta> {
    const [cab] = await db
      .select({
        id: almacenOrdenesCompra.id,
        numero: almacenOrdenesCompra.numero,
        sede_id: almacenOrdenesCompra.sede_id,
        proveedor_id: almacenOrdenesCompra.proveedor_id,
        almacen_destino_id: almacenOrdenesCompra.almacen_destino_id,
        fecha_emision: almacenOrdenesCompra.fecha_emision,
        fecha_entrega_esperada: almacenOrdenesCompra.fecha_entrega_esperada,
        moneda: almacenOrdenesCompra.moneda,
        condicion_pago: almacenOrdenesCompra.condicion_pago,
        estado: almacenOrdenesCompra.estado,
        subtotal: almacenOrdenesCompra.subtotal,
        igv: almacenOrdenesCompra.igv,
        total: almacenOrdenesCompra.total,
        observaciones: almacenOrdenesCompra.observaciones,
        motivo_anulacion: almacenOrdenesCompra.motivo_anulacion,
        usuario_registro_id: almacenOrdenesCompra.usuario_registro_id,
        usuario_anulacion_id: almacenOrdenesCompra.usuario_anulacion_id,
        fecha_anulacion: almacenOrdenesCompra.fecha_anulacion,
        created_at: almacenOrdenesCompra.created_at,
        updated_at: almacenOrdenesCompra.updated_at,
        sede_nombre: sedes.nombre,
        proveedor_razon_social: almacenProveedores.razon_social,
        proveedor_ruc: almacenProveedores.ruc,
        proveedor_direccion: almacenProveedores.direccion,
        proveedor_telefono: almacenProveedores.telefono,
        proveedor_email: almacenProveedores.email,
        proveedor_contacto: almacenProveedores.contacto,
        almacen_destino_nombre: almacenAlmacenes.nombre,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenOrdenesCompra)
      .innerJoin(sedes, eq(almacenOrdenesCompra.sede_id, sedes.id))
      .innerJoin(almacenProveedores, eq(almacenOrdenesCompra.proveedor_id, almacenProveedores.id))
      .leftJoin(almacenAlmacenes, eq(almacenOrdenesCompra.almacen_destino_id, almacenAlmacenes.id))
      .leftJoin(usuarios, eq(almacenOrdenesCompra.usuario_registro_id, usuarios.id))
      .where(eq(almacenOrdenesCompra.id, id));

    if (!cab) throw new AlmacenError('Orden de compra no encontrada', 404);

    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(cab.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede de esta orden de compra', 403);
    }

    // Cargar detalles de productos
    const itemsRaw = await db
      .select({
        id: almacenOrdenCompraDetalle.id,
        orden_compra_id: almacenOrdenCompraDetalle.orden_compra_id,
        producto_id: almacenOrdenCompraDetalle.producto_id,
        cantidad_solicitada: almacenOrdenCompraDetalle.cantidad_solicitada,
        cantidad_recibida: almacenOrdenCompraDetalle.cantidad_recibida,
        precio_unitario: almacenOrdenCompraDetalle.precio_unitario,
        subtotal: almacenOrdenCompraDetalle.subtotal,
        observaciones: almacenOrdenCompraDetalle.observaciones,
        created_at: almacenOrdenCompraDetalle.created_at,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        unidad_medida_nombre: almacenUnidadesMedida.nombre,
      })
      .from(almacenOrdenCompraDetalle)
      .innerJoin(almacenProductos, eq(almacenOrdenCompraDetalle.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .where(eq(almacenOrdenCompraDetalle.orden_compra_id, id));

    const items = itemsRaw.map((it) => ({
      ...it,
      saldo_pendiente: Math.max(0, Number(it.cantidad_solicitada) - Number(it.cantidad_recibida)),
    }));

    // Cargar ingresos vinculados
    const ingresos_relacionados = await db
      .select({
        id: almacenIngresos.id,
        numero: almacenIngresos.numero,
        fecha_ingreso: almacenIngresos.fecha_ingreso,
        tipo_documento: almacenIngresos.tipo_documento,
        numero_documento: almacenIngresos.numero_documento,
        estado: almacenIngresos.estado,
      })
      .from(almacenIngresos)
      .where(eq(almacenIngresos.orden_compra_id, id))
      .orderBy(desc(almacenIngresos.id));

    return {
      ...cab,
      items,
      ingresos_relacionados,
    };
  }

  async crear(
    data: CrearOrdenCompraInput,
    usuarioId: number,
    sedeDefectoId: number,
    sedesPermitidas?: number[]
  ): Promise<AlmacenOrdenCompraCompleta> {
    const sedeId = data.sede_id || sedeDefectoId;

    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(sedeId)) {
      throw new AlmacenError('No tienes acceso a la sede seleccionada', 403);
    }

    // Validar proveedor
    const [prov] = await db
      .select({ id: almacenProveedores.id, activo: almacenProveedores.activo })
      .from(almacenProveedores)
      .where(eq(almacenProveedores.id, data.proveedor_id));

    if (!prov) throw new AlmacenError('Proveedor no encontrado', 404);
    if (!prov.activo) throw new AlmacenError('El proveedor seleccionado está inactivo', 400);

    // Calcular montos económicos
    let subtotalTotal = 0;
    const itemsConSubtotal = data.items.map((it) => {
      const sub = Number((it.cantidad_solicitada * it.precio_unitario).toFixed(4));
      subtotalTotal += sub;
      return { ...it, subtotal: sub };
    });

    const igvTotal = Number((subtotalTotal * 0.18).toFixed(4));
    const totalFinal = Number((subtotalTotal + igvTotal).toFixed(4));

    // Transacción atómica
    const ordenCreada = await db.transaction(async (tx) => {
      // 1. Obtener siguiente correlativo tipo 'OC'
      const numero = await obtenerSiguienteCorrelativo(tx, 'OC', sedeId, data.fecha_emision);

      // 2. Insertar cabecera de orden de compra
      const [orden] = await tx
        .insert(almacenOrdenesCompra)
        .values({
          numero,
          sede_id: sedeId,
          proveedor_id: data.proveedor_id,
          almacen_destino_id: data.almacen_destino_id ?? null,
          fecha_emision: data.fecha_emision,
          fecha_entrega_esperada: data.fecha_entrega_esperada || null,
          moneda: data.moneda,
          condicion_pago: data.condicion_pago?.trim() || 'CONTADO',
          estado: 'PENDIENTE',
          subtotal: subtotalTotal,
          igv: igvTotal,
          total: totalFinal,
          observaciones: data.observaciones?.trim() || null,
          usuario_registro_id: usuarioId,
        })
        .returning();

      // 3. Insertar detalle
      for (const item of itemsConSubtotal) {
        await tx.insert(almacenOrdenCompraDetalle).values({
          orden_compra_id: orden.id,
          producto_id: item.producto_id,
          cantidad_solicitada: item.cantidad_solicitada,
          cantidad_recibida: 0,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          observaciones: item.observaciones?.trim() || null,
        });
      }

      return orden;
    });

    return this.obtenerPorId(ordenCreada.id, sedesPermitidas);
  }

  async anular(
    id: number,
    usuarioId: number,
    data: AnularOrdenCompraInput,
    sedesPermitidas?: number[]
  ): Promise<void> {
    const [orden] = await db
      .select({ id: almacenOrdenesCompra.id, sede_id: almacenOrdenesCompra.sede_id, estado: almacenOrdenesCompra.estado })
      .from(almacenOrdenesCompra)
      .where(eq(almacenOrdenesCompra.id, id));

    if (!orden) throw new AlmacenError('Orden de compra no encontrada', 404);

    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(orden.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede de esta orden de compra', 403);
    }

    if (orden.estado === 'ANULADA') {
      throw new AlmacenError('La orden de compra ya se encuentra anulada', 400);
    }

    // Verificar si tiene ingresos activos registrados
    const [ingresosActivos] = await db
      .select({ total: count() })
      .from(almacenIngresos)
      .where(
        and(
          eq(almacenIngresos.orden_compra_id, id),
          eq(almacenIngresos.estado, 'REGISTRADO')
        )
      );

    if (ingresosActivos && Number(ingresosActivos.total) > 0) {
      throw new AlmacenError(
        'No se puede anular la orden de compra porque ya cuenta con ingresos activos registrados en almacén. Debe anular primero dichos ingresos.',
        400
      );
    }

    await db
      .update(almacenOrdenesCompra)
      .set({
        estado: 'ANULADA',
        motivo_anulacion: data.motivo,
        usuario_anulacion_id: usuarioId,
        fecha_anulacion: sql`CURRENT_TIMESTAMP`,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(almacenOrdenesCompra.id, id));
  }
}
