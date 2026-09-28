import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL, count } from 'drizzle-orm';
import {
  db,
  almacenDespachos,
  almacenDespachoDetalle,
  almacenAlmacenes,
  almacenProductos,
  almacenLotes,
  almacenUnidadesMedida,
  almacenStock,
  almacenStockCustodia,
  almacenMovimientos,
  almacenPedidos,
  almacenPedidoDetalle,
  personal,
  usuarios,
  areas,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { obtenerSiguienteCorrelativo } from '../shared/almacen.correlativo';
import type { Paginado } from '../shared/almacen.types';
import type {
  CrearDespachoInput,
  AnularDespachoInput,
  ListarDespachosQuery,
} from './despachos.schema';
import type { AlmacenDespachoCompleto } from './despachos.types';

export class AlmacenDespachosService {
  async listar(
    f: ListarDespachosQuery,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenDespachoCompleto>> {
    const conditions: (SQL | undefined)[] = [];

    if (f.almacen_id) conditions.push(eq(almacenDespachos.almacen_id, f.almacen_id));
    if (f.receptor_personal_id) conditions.push(eq(almacenDespachos.receptor_personal_id, f.receptor_personal_id));
    if (f.estado) conditions.push(eq(almacenDespachos.estado, f.estado));
    if (f.fecha_desde) conditions.push(gte(almacenDespachos.fecha, `${f.fecha_desde} 00:00:00`));
    if (f.fecha_hasta) conditions.push(lte(almacenDespachos.fecha, `${f.fecha_hasta} 23:59:59`));

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
          ilike(almacenDespachos.numero, s),
          ilike(personal.nombres, s),
          ilike(personal.apellidos, s),
          ilike(personal.numero_documento, s)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenDespachos)
      .innerJoin(almacenAlmacenes, eq(almacenDespachos.almacen_id, almacenAlmacenes.id))
      .innerJoin(personal, eq(almacenDespachos.receptor_personal_id, personal.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenDespachos.id,
        numero: almacenDespachos.numero,
        almacen_id: almacenDespachos.almacen_id,
        receptor_personal_id: almacenDespachos.receptor_personal_id,
        area_id: almacenDespachos.area_id,
        pedido_id: almacenDespachos.pedido_id,
        fecha: almacenDespachos.fecha,
        observaciones: almacenDespachos.observaciones,
        estado: almacenDespachos.estado,
        motivo_anulacion: almacenDespachos.motivo_anulacion,
        usuario_registro_id: almacenDespachos.usuario_registro_id,
        usuario_anulacion_id: almacenDespachos.usuario_anulacion_id,
        fecha_anulacion: almacenDespachos.fecha_anulacion,
        created_at: almacenDespachos.created_at,
        updated_at: almacenDespachos.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        receptor_nombres: personal.nombres,
        receptor_apellidos: personal.apellidos,
        receptor_documento: personal.numero_documento,
        area_nombre: areas.nombre,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenDespachos)
      .innerJoin(almacenAlmacenes, eq(almacenDespachos.almacen_id, almacenAlmacenes.id))
      .innerJoin(personal, eq(almacenDespachos.receptor_personal_id, personal.id))
      .leftJoin(areas, eq(almacenDespachos.area_id, areas.id))
      .leftJoin(usuarios, eq(almacenDespachos.usuario_registro_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenDespachos.id))
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

  async obtener(id: number, sedesPermitidas?: number[]): Promise<AlmacenDespachoCompleto> {
    const [cab] = await db
      .select({
        id: almacenDespachos.id,
        numero: almacenDespachos.numero,
        almacen_id: almacenDespachos.almacen_id,
        receptor_personal_id: almacenDespachos.receptor_personal_id,
        area_id: almacenDespachos.area_id,
        pedido_id: almacenDespachos.pedido_id,
        fecha: almacenDespachos.fecha,
        observaciones: almacenDespachos.observaciones,
        estado: almacenDespachos.estado,
        motivo_anulacion: almacenDespachos.motivo_anulacion,
        usuario_registro_id: almacenDespachos.usuario_registro_id,
        usuario_anulacion_id: almacenDespachos.usuario_anulacion_id,
        fecha_anulacion: almacenDespachos.fecha_anulacion,
        created_at: almacenDespachos.created_at,
        updated_at: almacenDespachos.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        receptor_nombres: personal.nombres,
        receptor_apellidos: personal.apellidos,
        receptor_documento: personal.numero_documento,
        area_nombre: areas.nombre,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenDespachos)
      .innerJoin(almacenAlmacenes, eq(almacenDespachos.almacen_id, almacenAlmacenes.id))
      .innerJoin(personal, eq(almacenDespachos.receptor_personal_id, personal.id))
      .leftJoin(areas, eq(almacenDespachos.area_id, areas.id))
      .leftJoin(usuarios, eq(almacenDespachos.usuario_registro_id, usuarios.id))
      .where(eq(almacenDespachos.id, id));

    if (!cab) throw new AlmacenError('Despacho no encontrado', 404);

    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(cab.sede_id)) {
      throw new AlmacenError('No tienes acceso a la sede de este despacho', 403);
    }

    const items = await db
      .select({
        id: almacenDespachoDetalle.id,
        despacho_id: almacenDespachoDetalle.despacho_id,
        pedido_detalle_id: almacenDespachoDetalle.pedido_detalle_id,
        producto_id: almacenDespachoDetalle.producto_id,
        lote_id: almacenDespachoDetalle.lote_id,
        cantidad: almacenDespachoDetalle.cantidad,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        numero_lote: almacenLotes.numero_lote,
        marca: almacenLotes.marca,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
      })
      .from(almacenDespachoDetalle)
      .innerJoin(almacenProductos, eq(almacenDespachoDetalle.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .innerJoin(almacenLotes, eq(almacenDespachoDetalle.lote_id, almacenLotes.id))
      .where(eq(almacenDespachoDetalle.despacho_id, id));

    return { ...cab, items };
  }

  async crear(
    data: CrearDespachoInput,
    usuarioId: number,
    sedesPermitidas?: number[]
  ): Promise<AlmacenDespachoCompleto> {
    // 1. Validar almacén
    const [alm] = await db
      .select({ id: almacenAlmacenes.id, sede_id: almacenAlmacenes.sede_id, activo: almacenAlmacenes.activo })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, data.almacen_id));

    if (!alm) throw new AlmacenError('Almacén no encontrado', 404);
    if (!alm.activo) throw new AlmacenError('El almacén está inactivo', 400);

    if (sedesPermitidas !== undefined && !sedesPermitidas.includes(alm.sede_id)) {
      throw new AlmacenError('No tiene acceso a la sede de este almacén', 403);
    }

    // 2. Validar receptor
    const [receptor] = await db
      .select({ id: personal.id, activo: personal.activo, nombres: personal.nombres })
      .from(personal)
      .where(eq(personal.id, data.receptor_personal_id));

    if (!receptor) throw new AlmacenError('El colaborador receptor no existe', 404);
    if (!receptor.activo) throw new AlmacenError('El colaborador receptor está inactivo o cesado', 400);

    const fechaNegocio = data.fecha ? data.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);

    // 3. Transacción atómica
    const despachoCreado = await db.transaction(async (tx) => {
      const numero = await obtenerSiguienteCorrelativo(tx, 'DES', alm.sede_id, fechaNegocio);

      const [despacho] = await tx
        .insert(almacenDespachos)
        .values({
          numero,
          almacen_id: data.almacen_id,
          receptor_personal_id: data.receptor_personal_id,
          area_id: data.area_id ?? null,
          pedido_id: data.pedido_id ?? null,
          observaciones: data.observaciones?.trim() || null,
          usuario_registro_id: usuarioId,
          estado: 'REGISTRADO',
        })
        .returning();

      for (const line of data.items) {
        // Validar saldo disponible en almacén
        const [stockFisico] = await tx
          .select({ cantidad: almacenStock.cantidad })
          .from(almacenStock)
          .where(and(eq(almacenStock.almacen_id, data.almacen_id), eq(almacenStock.lote_id, line.lote_id)));

        if (!stockFisico || Number(stockFisico.cantidad) < line.cantidad) {
          throw new AlmacenError(
            `Stock insuficiente en almacén para el lote ID ${line.lote_id}. Disponible: ${stockFisico?.cantidad ?? 0}`,
            400,
            'STOCK_INSUFICIENTE'
          );
        }

        // a) Descontar de almacén físico
        await tx
          .update(almacenStock)
          .set({
            cantidad: sql`${almacenStock.cantidad} - ${line.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(and(eq(almacenStock.almacen_id, data.almacen_id), eq(almacenStock.lote_id, line.lote_id)));

        // b) Incrementar o crear en stock_custodia del trabajador
        await tx
          .insert(almacenStockCustodia)
          .values({
            personal_id: data.receptor_personal_id,
            almacen_origen_id: data.almacen_id,
            producto_id: line.producto_id,
            lote_id: line.lote_id,
            cantidad: line.cantidad,
          })
          .onConflictDoUpdate({
            target: [
              almacenStockCustodia.personal_id,
              almacenStockCustodia.almacen_origen_id,
              almacenStockCustodia.lote_id,
            ],
            set: {
              cantidad: sql`${almacenStockCustodia.cantidad} + ${line.cantidad}`,
              updated_at: sql`CURRENT_TIMESTAMP`,
            },
          });

        // c) Detalle de despacho
        const [det] = await tx
          .insert(almacenDespachoDetalle)
          .values({
            despacho_id: despacho.id,
            pedido_detalle_id: line.pedido_detalle_id ?? null,
            producto_id: line.producto_id,
            lote_id: line.lote_id,
            cantidad: line.cantidad,
          })
          .returning();

        // d) Kardex inmutable
        await tx.insert(almacenMovimientos).values({
          tipo: 'DESPACHO',
          sede_id: alm.sede_id,
          almacen_id: data.almacen_id,
          personal_id: data.receptor_personal_id,
          producto_id: line.producto_id,
          lote_id: line.lote_id,
          cantidad: line.cantidad,
          documento_tipo: 'DESPACHO',
          documento_id: despacho.id,
          documento_detalle_id: det.id,
          usuario_id: usuarioId,
        });

        // e) Si atiende pedido detalle
        if (line.pedido_detalle_id) {
          await tx
            .update(almacenPedidoDetalle)
            .set({
              cantidad_atendida: sql`${almacenPedidoDetalle.cantidad_atendida} + ${line.cantidad}`,
            })
            .where(eq(almacenPedidoDetalle.id, line.pedido_detalle_id));
        }
      }

      // f) Si hay pedido_id asociado, verificar si fue completado
      if (data.pedido_id) {
        const lineasPedido = await tx
          .select({
            solicitada: almacenPedidoDetalle.cantidad_solicitada,
            aprobada: almacenPedidoDetalle.cantidad_aprobada,
            atendida: almacenPedidoDetalle.cantidad_atendida,
          })
          .from(almacenPedidoDetalle)
          .where(eq(almacenPedidoDetalle.pedido_id, data.pedido_id));

        const todasCompletas = lineasPedido.every(
          (lp) => Number(lp.atendida) >= Number(lp.aprobada ?? lp.solicitada)
        );

        await tx
          .update(almacenPedidos)
          .set({
            estado: todasCompletas ? 'ATENDIDO' : 'ATENDIDO_PARCIAL',
            fecha_atencion: sql`CURRENT_TIMESTAMP`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(almacenPedidos.id, data.pedido_id));
      }

      return despacho;
    });

    return this.obtener(despachoCreado.id, sedesPermitidas);
  }

  async anular(
    id: number,
    data: AnularDespachoInput,
    usuarioId: number,
    sedesPermitidas?: number[]
  ): Promise<AlmacenDespachoCompleto> {
    const actual = await this.obtener(id, sedesPermitidas);

    if (actual.estado === 'ANULADO') {
      throw new AlmacenError('El despacho ya se encuentra anulado', 400);
    }

    await db.transaction(async (tx) => {
      // 1. Validar que el personal aún tenga el saldo en custodia
      for (const item of actual.items || []) {
        const [custodia] = await tx
          .select({ cantidad: almacenStockCustodia.cantidad })
          .from(almacenStockCustodia)
          .where(
            and(
              eq(almacenStockCustodia.personal_id, actual.receptor_personal_id),
              eq(almacenStockCustodia.almacen_origen_id, actual.almacen_id),
              eq(almacenStockCustodia.lote_id, item.lote_id)
            )
          );

        if (!custodia || Number(custodia.cantidad) < Number(item.cantidad)) {
          throw new AlmacenError(
            `No se puede anular el despacho: el colaborador ya consumió parte de los insumos entregados (Lote ID: ${item.lote_id})`,
            400,
            'CUSTODIA_INSUFICIENTE_PARA_ANULAR'
          );
        }

        // a) Revertir custodia: restar de custodia
        await tx
          .update(almacenStockCustodia)
          .set({
            cantidad: sql`${almacenStockCustodia.cantidad} - ${item.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(almacenStockCustodia.personal_id, actual.receptor_personal_id),
              eq(almacenStockCustodia.almacen_origen_id, actual.almacen_id),
              eq(almacenStockCustodia.lote_id, item.lote_id)
            )
          );

        // b) Devolver a stock de almacén físico
        await tx
          .update(almacenStock)
          .set({
            cantidad: sql`${almacenStock.cantidad} + ${item.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(and(eq(almacenStock.almacen_id, actual.almacen_id), eq(almacenStock.lote_id, item.lote_id)));

        // c) Registrar movimiento ANULACION en kardex
        const [movOriginal] = await tx
          .select({ id: almacenMovimientos.id })
          .from(almacenMovimientos)
          .where(
            and(
              eq(almacenMovimientos.documento_tipo, 'DESPACHO'),
              eq(almacenMovimientos.documento_id, actual.id),
              eq(almacenMovimientos.lote_id, item.lote_id)
            )
          );

        if (movOriginal) {
          await tx.insert(almacenMovimientos).values({
            tipo: 'ANULACION',
            sede_id: actual.sede_id,
            almacen_id: actual.almacen_id,
            personal_id: actual.receptor_personal_id,
            producto_id: item.producto_id,
            lote_id: item.lote_id,
            cantidad: item.cantidad,
            documento_tipo: 'DESPACHO',
            documento_id: actual.id,
            anula_movimiento_id: movOriginal.id,
            observacion: data.motivo,
            usuario_id: usuarioId,
          });
        }
      }

      // 2. Marcar despacho como ANULADO
      await tx
        .update(almacenDespachos)
        .set({
          estado: 'ANULADO',
          motivo_anulacion: data.motivo,
          usuario_anulacion_id: usuarioId,
          fecha_anulacion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenDespachos.id, id));
    });

    return this.obtener(id, sedesPermitidas);
  }
}

export const despachosService = new AlmacenDespachosService();
