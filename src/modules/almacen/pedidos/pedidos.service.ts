import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL, count } from 'drizzle-orm';
import {
  db,
  almacenPedidos,
  almacenPedidoDetalle,
  almacenAlmacenes,
  almacenProductos,
  almacenUnidadesMedida,
  almacenStock,
  personal,
  usuarios,
  areas,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { buildMultiFilter } from '../shared/almacen.filters';
import { obtenerSiguienteCorrelativo } from '../shared/almacen.correlativo';
import type { Paginado } from '../shared/almacen.types';
import type {
  CrearPedidoInput,
  AprobarPedidoInput,
  RechazarPedidoInput,
  AnularPedidoInput,
  ListarPedidosQuery,
} from './pedidos.schema';
import type { AlmacenPedidoCompleto, ItemPedidoDetalle } from './pedidos.types';

export class AlmacenPedidosService {
  private async resolverPersonalId(usuarioId: number, targetPersonalId?: number): Promise<number> {
    if (targetPersonalId) return targetPersonalId;

    const [u] = await db
      .select({ personal_id: usuarios.personal_id })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId))
      .limit(1);

    if (!u?.personal_id) {
      throw new AlmacenError('Su usuario no está vinculado a una ficha de personal', 400);
    }
    return u.personal_id;
  }

  async listar(
    f: ListarPedidosQuery,
    usuarioId: number,
    puedeAprobar: boolean,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenPedidoCompleto>> {
    let targetPersonalId = f.solicitante_personal_id;
    if (!puedeAprobar) {
      targetPersonalId = await this.resolverPersonalId(usuarioId, undefined).catch(() => -1);
    }

    const conditions: (SQL | undefined)[] = [];

    const cAlmacen = buildMultiFilter(almacenPedidos.almacen_id, f.almacen_id);
    if (cAlmacen) conditions.push(cAlmacen);
    if (targetPersonalId) conditions.push(eq(almacenPedidos.solicitante_personal_id, targetPersonalId));
    const cEstado = buildMultiFilter(almacenPedidos.estado, f.estado);
    if (cEstado) conditions.push(cEstado);
    if (f.fecha_desde) conditions.push(gte(almacenPedidos.created_at, `${f.fecha_desde} 00:00:00`));
    if (f.fecha_hasta) conditions.push(lte(almacenPedidos.created_at, `${f.fecha_hasta} 23:59:59`));

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
          ilike(almacenPedidos.numero, s),
          ilike(personal.nombres, s),
          ilike(personal.apellidos, s),
          ilike(personal.numero_documento, s)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenPedidos)
      .innerJoin(almacenAlmacenes, eq(almacenPedidos.almacen_id, almacenAlmacenes.id))
      .leftJoin(personal, eq(almacenPedidos.solicitante_personal_id, personal.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenPedidos.id,
        numero: almacenPedidos.numero,
        almacen_id: almacenPedidos.almacen_id,
        solicitante_personal_id: almacenPedidos.solicitante_personal_id,
        area_id: almacenPedidos.area_id,
        estado: almacenPedidos.estado,
        observaciones: almacenPedidos.observaciones,
        motivo_rechazo: almacenPedidos.motivo_rechazo,
        motivo_anulacion: almacenPedidos.motivo_anulacion,
        motivo_cierre: almacenPedidos.motivo_cierre,
        usuario_registro_id: almacenPedidos.usuario_registro_id,
        usuario_aprobacion_id: almacenPedidos.usuario_aprobacion_id,
        fecha_aprobacion: almacenPedidos.fecha_aprobacion,
        fecha_atencion: almacenPedidos.fecha_atencion,
        usuario_anulacion_id: almacenPedidos.usuario_anulacion_id,
        fecha_anulacion: almacenPedidos.fecha_anulacion,
        created_at: almacenPedidos.created_at,
        updated_at: almacenPedidos.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        solicitante_nombres: personal.nombres,
        solicitante_apellidos: personal.apellidos,
        solicitante_documento: personal.numero_documento,
        area_nombre: areas.nombre,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenPedidos)
      .innerJoin(almacenAlmacenes, eq(almacenPedidos.almacen_id, almacenAlmacenes.id))
      .leftJoin(personal, eq(almacenPedidos.solicitante_personal_id, personal.id))
      .leftJoin(areas, eq(almacenPedidos.area_id, areas.id))
      .leftJoin(usuarios, eq(almacenPedidos.usuario_registro_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenPedidos.created_at))
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

  async obtener(id: number): Promise<AlmacenPedidoCompleto> {
    const [p] = await db
      .select({
        id: almacenPedidos.id,
        numero: almacenPedidos.numero,
        almacen_id: almacenPedidos.almacen_id,
        solicitante_personal_id: almacenPedidos.solicitante_personal_id,
        area_id: almacenPedidos.area_id,
        estado: almacenPedidos.estado,
        observaciones: almacenPedidos.observaciones,
        motivo_rechazo: almacenPedidos.motivo_rechazo,
        motivo_anulacion: almacenPedidos.motivo_anulacion,
        motivo_cierre: almacenPedidos.motivo_cierre,
        usuario_registro_id: almacenPedidos.usuario_registro_id,
        usuario_aprobacion_id: almacenPedidos.usuario_aprobacion_id,
        fecha_aprobacion: almacenPedidos.fecha_aprobacion,
        fecha_atencion: almacenPedidos.fecha_atencion,
        usuario_anulacion_id: almacenPedidos.usuario_anulacion_id,
        fecha_anulacion: almacenPedidos.fecha_anulacion,
        created_at: almacenPedidos.created_at,
        updated_at: almacenPedidos.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        solicitante_nombres: personal.nombres,
        solicitante_apellidos: personal.apellidos,
        solicitante_documento: personal.numero_documento,
        area_nombre: areas.nombre,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenPedidos)
      .innerJoin(almacenAlmacenes, eq(almacenPedidos.almacen_id, almacenAlmacenes.id))
      .leftJoin(personal, eq(almacenPedidos.solicitante_personal_id, personal.id))
      .leftJoin(areas, eq(almacenPedidos.area_id, areas.id))
      .leftJoin(usuarios, eq(almacenPedidos.usuario_registro_id, usuarios.id))
      .where(eq(almacenPedidos.id, id))
      .limit(1);

    if (!p) throw new AlmacenError('Pedido no encontrado', 404);

    const detalleRows = await db
      .select({
        id: almacenPedidoDetalle.id,
        pedido_id: almacenPedidoDetalle.pedido_id,
        producto_id: almacenPedidoDetalle.producto_id,
        cantidad_solicitada: almacenPedidoDetalle.cantidad_solicitada,
        cantidad_aprobada: almacenPedidoDetalle.cantidad_aprobada,
        cantidad_atendida: almacenPedidoDetalle.cantidad_atendida,
        observacion: almacenPedidoDetalle.observacion,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        unidad_medida_nombre: almacenUnidadesMedida.nombre,
      })
      .from(almacenPedidoDetalle)
      .innerJoin(almacenProductos, eq(almacenPedidoDetalle.producto_id, almacenProductos.id))
      .leftJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .where(eq(almacenPedidoDetalle.pedido_id, id));

    const items: ItemPedidoDetalle[] = [];
    for (const d of detalleRows) {
      const [stk] = await db
        .select({
          total: sql<string>`coalesce(sum(${almacenStock.cantidad}), 0)::text`,
        })
        .from(almacenStock)
        .where(
          and(
            eq(almacenStock.almacen_id, p.almacen_id),
            eq(almacenStock.producto_id, d.producto_id)
          )
        );

      items.push({
        id: d.id,
        pedido_id: d.pedido_id,
        producto_id: d.producto_id,
        cantidad_solicitada: Number(d.cantidad_solicitada),
        cantidad_aprobada: d.cantidad_aprobada !== null ? Number(d.cantidad_aprobada) : null,
        cantidad_atendida: Number(d.cantidad_atendida),
        observacion: d.observacion,
        producto_codigo: d.producto_codigo,
        producto_nombre: d.producto_nombre,
        unidad_medida_codigo: d.unidad_medida_codigo || '',
        unidad_medida_nombre: d.unidad_medida_nombre || '',
        stock_disponible_almacen: stk?.total || '0',
      });
    }

    return { ...p, items };
  }

  async crear(
    data: CrearPedidoInput,
    usuarioId: number
  ): Promise<AlmacenPedidoCompleto> {
    const personalId = await this.resolverPersonalId(usuarioId, data.solicitante_personal_id);

    const [alm] = await db
      .select({ sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, data.almacen_id))
      .limit(1);

    if (!alm) throw new AlmacenError('Almacén no encontrado', 404);

    const pedidoCreado = await db.transaction(async (tx) => {
      const fechaNegocio = new Date().toISOString().slice(0, 10);
      const numero = await obtenerSiguienteCorrelativo(tx, 'PED', alm.sede_id, fechaNegocio);

      const obsItems = data.items
        .map((i) => i.observacion?.trim())
        .filter(Boolean) as string[];

      const observacionesCabecera =
        data.observaciones?.trim() || (obsItems.length > 0 ? obsItems.join('; ') : null);

      const [pedido] = await tx
        .insert(almacenPedidos)
        .values({
          numero,
          almacen_id: data.almacen_id,
          solicitante_personal_id: personalId,
          area_id: data.area_id,
          estado: 'PENDIENTE',
          observaciones: observacionesCabecera,
          usuario_registro_id: usuarioId,
        })
        .returning();

      for (const item of data.items) {
        await tx.insert(almacenPedidoDetalle).values({
          pedido_id: pedido.id,
          producto_id: item.producto_id,
          cantidad_solicitada: item.cantidad_solicitada,
          cantidad_aprobada: item.cantidad_solicitada,
          cantidad_atendida: 0,
          observacion: item.observacion?.trim() || null,
        });
      }

      return pedido;
    });

    return this.obtener(pedidoCreado.id);
  }

  async aprobar(
    id: number,
    data: AprobarPedidoInput,
    usuarioId: number
  ): Promise<AlmacenPedidoCompleto> {
    const actual = await this.obtener(id);
    if (actual.estado !== 'PENDIENTE') {
      throw new AlmacenError(`No se puede aprobar un pedido en estado ${actual.estado}`, 400);
    }

    await db.transaction(async (tx) => {
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await tx
            .update(almacenPedidoDetalle)
            .set({ cantidad_aprobada: item.cantidad_aprobada })
            .where(
              and(
                eq(almacenPedidoDetalle.id, item.detalle_id),
                eq(almacenPedidoDetalle.pedido_id, id)
              )
            );
        }
      }

      await tx
        .update(almacenPedidos)
        .set({
          estado: 'APROBADO',
          usuario_aprobacion_id: usuarioId,
          fecha_aprobacion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenPedidos.id, id));
    });

    return this.obtener(id);
  }

  async rechazar(
    id: number,
    data: RechazarPedidoInput,
    usuarioId: number
  ): Promise<AlmacenPedidoCompleto> {
    const actual = await this.obtener(id);
    if (actual.estado !== 'PENDIENTE') {
      throw new AlmacenError(`No se puede rechazar un pedido en estado ${actual.estado}`, 400);
    }

    await db
      .update(almacenPedidos)
      .set({
        estado: 'RECHAZADO',
        motivo_rechazo: data.motivo,
        usuario_aprobacion_id: usuarioId,
        fecha_aprobacion: sql`CURRENT_TIMESTAMP`,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(almacenPedidos.id, id));

    return this.obtener(id);
  }

  async anular(
    id: number,
    data: AnularPedidoInput,
    usuarioId: number
  ): Promise<AlmacenPedidoCompleto> {
    const actual = await this.obtener(id);
    if (!['PENDIENTE', 'APROBADO'].includes(actual.estado)) {
      throw new AlmacenError(`No se puede anular un pedido en estado ${actual.estado}`, 400);
    }

    const tieneAtenciones = (actual.items || []).some((i) => Number(i.cantidad_atendida) > 0);
    if (tieneAtenciones) {
      throw new AlmacenError('El pedido ya tiene despachos asociados y no puede anularse', 400);
    }

    await db
      .update(almacenPedidos)
      .set({
        estado: 'ANULADO',
        motivo_anulacion: data.motivo,
        usuario_anulacion_id: usuarioId,
        fecha_anulacion: sql`CURRENT_TIMESTAMP`,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(almacenPedidos.id, id));

    return this.obtener(id);
  }
}

export const pedidosService = new AlmacenPedidosService();
