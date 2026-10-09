import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL, count } from 'drizzle-orm';
import {
  db,
  almacenTransferencias,
  almacenTransferenciaDetalle,
  almacenAlmacenes,
  almacenProductos,
  almacenLotes,
  almacenUnidadesMedida,
  almacenStock,
  almacenMovimientos,
  usuarios,
  sedes,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { buildMultiFilter } from '../shared/almacen.filters';
import { obtenerSiguienteCorrelativo } from '../shared/almacen.correlativo';
import type { Paginado } from '../shared/almacen.types';
import type {
  CrearTransferenciaInput,
  RecibirTransferenciaInput,
  AnularTransferenciaInput,
  ListarTransferenciasQuery,
} from './transferencias.schema';
import type { AlmacenTransferenciaCompleta, ItemTransferenciaDetalle } from './transferencias.types';

export class AlmacenTransferenciasService {
  async listar(
    f: ListarTransferenciasQuery,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenTransferenciaCompleta>> {
    const conditions: (SQL | undefined)[] = [];

    const cOrigen = buildMultiFilter(almacenTransferencias.almacen_origen_id, f.almacen_origen_id);
    if (cOrigen) conditions.push(cOrigen);
    const cDestino = buildMultiFilter(almacenTransferencias.almacen_destino_id, f.almacen_destino_id);
    if (cDestino) conditions.push(cDestino);
    if (f.almacen_id && f.almacen_id.length > 0) {
      conditions.push(
        or(
          f.almacen_id.length === 1
            ? eq(almacenTransferencias.almacen_origen_id, f.almacen_id[0])
            : inArray(almacenTransferencias.almacen_origen_id, f.almacen_id),
          f.almacen_id.length === 1
            ? eq(almacenTransferencias.almacen_destino_id, f.almacen_id[0])
            : inArray(almacenTransferencias.almacen_destino_id, f.almacen_id)
        )
      );
    }
    const cEstado = buildMultiFilter(almacenTransferencias.estado, f.estado);
    if (cEstado) conditions.push(cEstado);
    if (f.fecha_desde) conditions.push(gte(almacenTransferencias.fecha_envio, `${f.fecha_desde} 00:00:00`));
    if (f.fecha_hasta) conditions.push(lte(almacenTransferencias.fecha_envio, `${f.fecha_hasta} 23:59:59`));

    if (f.search) {
      conditions.push(ilike(almacenTransferencias.numero, `%${f.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenTransferencias)
      .where(where);

    const rows = await db
      .select({
        id: almacenTransferencias.id,
        numero: almacenTransferencias.numero,
        almacen_origen_id: almacenTransferencias.almacen_origen_id,
        almacen_destino_id: almacenTransferencias.almacen_destino_id,
        estado: almacenTransferencias.estado,
        usuario_envio_id: almacenTransferencias.usuario_envio_id,
        fecha_envio: almacenTransferencias.fecha_envio,
        usuario_recepcion_id: almacenTransferencias.usuario_recepcion_id,
        fecha_recepcion: almacenTransferencias.fecha_recepcion,
        motivo_anulacion: almacenTransferencias.motivo_anulacion,
        usuario_anulacion_id: almacenTransferencias.usuario_anulacion_id,
        fecha_anulacion: almacenTransferencias.fecha_anulacion,
        observaciones: almacenTransferencias.observaciones,
        created_at: almacenTransferencias.created_at,
        updated_at: almacenTransferencias.updated_at,
        usuario_envio_nombre: usuarios.username,
      })
      .from(almacenTransferencias)
      .leftJoin(usuarios, eq(almacenTransferencias.usuario_envio_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenTransferencias.created_at))
      .limit(f.limit)
      .offset((f.page - 1) * f.limit);

    // Enriquecer con nombres de almacenes y sedes
    const items: AlmacenTransferenciaCompleta[] = [];
    for (const r of rows) {
      const [almOrigen] = await db
        .select({ nombre: almacenAlmacenes.nombre, sede_id: almacenAlmacenes.sede_id })
        .from(almacenAlmacenes)
        .where(eq(almacenAlmacenes.id, r.almacen_origen_id));

      const [almDestino] = await db
        .select({ nombre: almacenAlmacenes.nombre, sede_id: almacenAlmacenes.sede_id })
        .from(almacenAlmacenes)
        .where(eq(almacenAlmacenes.id, r.almacen_destino_id));

      items.push({
        ...r,
        almacen_origen_nombre: almOrigen?.nombre || '',
        sede_origen_id: almOrigen?.sede_id || 0,
        almacen_destino_nombre: almDestino?.nombre || '',
        sede_destino_id: almDestino?.sede_id || 0,
      });
    }

    return {
      items,
      total,
      page: f.page,
      limit: f.limit,
      totalPages: Math.ceil(total / f.limit),
    };
  }

  async obtener(id: number): Promise<AlmacenTransferenciaCompleta> {
    const [t] = await db
      .select({
        id: almacenTransferencias.id,
        numero: almacenTransferencias.numero,
        almacen_origen_id: almacenTransferencias.almacen_origen_id,
        almacen_destino_id: almacenTransferencias.almacen_destino_id,
        estado: almacenTransferencias.estado,
        usuario_envio_id: almacenTransferencias.usuario_envio_id,
        fecha_envio: almacenTransferencias.fecha_envio,
        usuario_recepcion_id: almacenTransferencias.usuario_recepcion_id,
        fecha_recepcion: almacenTransferencias.fecha_recepcion,
        motivo_anulacion: almacenTransferencias.motivo_anulacion,
        usuario_anulacion_id: almacenTransferencias.usuario_anulacion_id,
        fecha_anulacion: almacenTransferencias.fecha_anulacion,
        observaciones: almacenTransferencias.observaciones,
        created_at: almacenTransferencias.created_at,
        updated_at: almacenTransferencias.updated_at,
        usuario_envio_nombre: usuarios.username,
      })
      .from(almacenTransferencias)
      .leftJoin(usuarios, eq(almacenTransferencias.usuario_envio_id, usuarios.id))
      .where(eq(almacenTransferencias.id, id))
      .limit(1);

    if (!t) throw new AlmacenError('Transferencia no encontrada', 404);

    const [almOrigen] = await db
      .select({ nombre: almacenAlmacenes.nombre, sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, t.almacen_origen_id));

    const [almDestino] = await db
      .select({ nombre: almacenAlmacenes.nombre, sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, t.almacen_destino_id));

    let usuarioRecepcionNombre: string | null = null;
    if (t.usuario_recepcion_id) {
      const [uRec] = await db
        .select({ username: usuarios.username })
        .from(usuarios)
        .where(eq(usuarios.id, t.usuario_recepcion_id));
      usuarioRecepcionNombre = uRec?.username || null;
    }

    const itemsRows = await db
      .select({
        id: almacenTransferenciaDetalle.id,
        transferencia_id: almacenTransferenciaDetalle.transferencia_id,
        producto_id: almacenTransferenciaDetalle.producto_id,
        lote_id: almacenTransferenciaDetalle.lote_id,
        cantidad_enviada: almacenTransferenciaDetalle.cantidad_enviada,
        cantidad_recibida: almacenTransferenciaDetalle.cantidad_recibida,
        motivo_diferencia: almacenTransferenciaDetalle.motivo_diferencia,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        unidad_medida_nombre: almacenUnidadesMedida.nombre,
        numero_lote: almacenLotes.numero_lote,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
      })
      .from(almacenTransferenciaDetalle)
      .innerJoin(almacenProductos, eq(almacenTransferenciaDetalle.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .innerJoin(almacenLotes, eq(almacenTransferenciaDetalle.lote_id, almacenLotes.id))
      .where(eq(almacenTransferenciaDetalle.transferencia_id, id));

    const items: ItemTransferenciaDetalle[] = itemsRows.map((r) => ({
      ...r,
      cantidad_enviada: Number(r.cantidad_enviada),
      cantidad_recibida: r.cantidad_recibida !== null ? Number(r.cantidad_recibida) : null,
    }));

    return {
      ...t,
      almacen_origen_nombre: almOrigen?.nombre || '',
      sede_origen_id: almOrigen?.sede_id || 0,
      almacen_destino_nombre: almDestino?.nombre || '',
      sede_destino_id: almDestino?.sede_id || 0,
      usuario_recepcion_nombre: usuarioRecepcionNombre,
      items,
    };
  }

  async crear(
    data: CrearTransferenciaInput,
    usuarioId: number
  ): Promise<AlmacenTransferenciaCompleta> {
    const [almOrigen] = await db
      .select({ sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, data.almacen_origen_id));

    if (!almOrigen) throw new AlmacenError('Almacén origen no encontrado', 404);

    const transfCreada = await db.transaction(async (tx) => {
      const fechaNegocio = new Date().toISOString().slice(0, 10);
      const numero = await obtenerSiguienteCorrelativo(tx, 'TRA', almOrigen.sede_id, fechaNegocio);

      const [transferencia] = await tx
        .insert(almacenTransferencias)
        .values({
          numero,
          almacen_origen_id: data.almacen_origen_id,
          almacen_destino_id: data.almacen_destino_id,
          estado: 'EN_TRANSITO',
          usuario_envio_id: usuarioId,
          observaciones: data.observaciones,
        })
        .returning();

      for (const item of data.items) {
        // Verificar stock en almacén origen
        const [stk] = await tx
          .select({ id: almacenStock.id, cantidad: almacenStock.cantidad })
          .from(almacenStock)
          .where(
            and(
              eq(almacenStock.almacen_id, data.almacen_origen_id),
              eq(almacenStock.lote_id, item.lote_id)
            )
          )
          .limit(1);

        if (!stk || Number(stk.cantidad) < item.cantidad_enviada) {
          throw new AlmacenError(
            `Stock insuficiente en almacén origen para transferir el lote seleccionado (Disponible: ${stk?.cantidad ?? 0}, Solicitado: ${item.cantidad_enviada})`,
            400
          );
        }

        // Descontar de stock de origen
        await tx
          .update(almacenStock)
          .set({
            cantidad: sql`${almacenStock.cantidad} - ${item.cantidad_enviada}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(almacenStock.id, stk.id));

        // Registrar detalle
        await tx.insert(almacenTransferenciaDetalle).values({
          transferencia_id: transferencia.id,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad_enviada: item.cantidad_enviada,
        });

        // Registrar en kardex de origen
        await tx.insert(almacenMovimientos).values({
          tipo: 'TRANSFERENCIA_SALIDA',
          sede_id: almOrigen.sede_id,
          almacen_id: data.almacen_origen_id,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad: item.cantidad_enviada,
          documento_tipo: 'TRANSFERENCIA',
          documento_id: transferencia.id,
          observacion: `Envío a otro almacén. Transf: ${numero}`,
          usuario_id: usuarioId,
        });
      }

      return transferencia;
    });

    return this.obtener(transfCreada.id);
  }

  async recibir(
    id: number,
    data: RecibirTransferenciaInput,
    usuarioId: number
  ): Promise<AlmacenTransferenciaCompleta> {
    const actual = await this.obtener(id);
    if (actual.estado !== 'EN_TRANSITO') {
      throw new AlmacenError(`No se puede recepcionar una transferencia en estado ${actual.estado}`, 400);
    }

    const [almDestino] = await db
      .select({ sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, actual.almacen_destino_id));

    if (!almDestino) throw new AlmacenError('Almacén destino no encontrado', 404);

    return await db.transaction(async (tx) => {
      for (const itemRecibido of data.items) {
        const itemOriginal = (actual.items || []).find((i) => i.id === itemRecibido.detalle_id);
        if (!itemOriginal) {
          throw new AlmacenError(`Ítem de transferencia ID ${itemRecibido.detalle_id} no encontrado`, 404);
        }

        if (itemRecibido.cantidad_recibida > itemOriginal.cantidad_enviada) {
          throw new AlmacenError(
            `La cantidad recibida (${itemRecibido.cantidad_recibida}) no puede superar la enviada (${itemOriginal.cantidad_enviada})`,
            400
          );
        }

        // Actualizar detalle con cantidad recibida y motivo de diferencia si hubo
        await tx
          .update(almacenTransferenciaDetalle)
          .set({
            cantidad_recibida: itemRecibido.cantidad_recibida,
            motivo_diferencia: itemRecibido.motivo_diferencia,
          })
          .where(eq(almacenTransferenciaDetalle.id, itemRecibido.detalle_id));

        // Si se recibieron unidades > 0, sumar al stock del almacén destino
        if (itemRecibido.cantidad_recibida > 0) {
          const [stkDestino] = await tx
            .select({ id: almacenStock.id })
            .from(almacenStock)
            .where(
              and(
                eq(almacenStock.almacen_id, actual.almacen_destino_id),
                eq(almacenStock.lote_id, itemOriginal.lote_id)
              )
            )
            .limit(1);

          if (stkDestino) {
            await tx
              .update(almacenStock)
              .set({
                cantidad: sql`${almacenStock.cantidad} + ${itemRecibido.cantidad_recibida}`,
                updated_at: sql`CURRENT_TIMESTAMP`,
              })
              .where(eq(almacenStock.id, stkDestino.id));
          } else {
            await tx.insert(almacenStock).values({
              almacen_id: actual.almacen_destino_id,
              producto_id: itemOriginal.producto_id,
              lote_id: itemOriginal.lote_id,
              cantidad: itemRecibido.cantidad_recibida,
            });
          }

          // Kardex de entrada en destino
          await tx.insert(almacenMovimientos).values({
            tipo: 'TRANSFERENCIA_ENTRADA',
            sede_id: almDestino.sede_id,
            almacen_id: actual.almacen_destino_id,
            producto_id: itemOriginal.producto_id,
            lote_id: itemOriginal.lote_id,
            cantidad: itemRecibido.cantidad_recibida,
            documento_tipo: 'TRANSFERENCIA',
            documento_id: actual.id,
            observacion: `Recepción de transferencia: ${actual.numero}`,
            usuario_id: usuarioId,
          });
        }
      }

      await tx
        .update(almacenTransferencias)
        .set({
          estado: 'RECIBIDA',
          usuario_recepcion_id: usuarioId,
          fecha_recepcion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenTransferencias.id, id));

      return this.obtener(id);
    });
  }

  async anular(
    id: number,
    data: AnularTransferenciaInput,
    usuarioId: number
  ): Promise<AlmacenTransferenciaCompleta> {
    const actual = await this.obtener(id);
    if (actual.estado !== 'EN_TRANSITO') {
      throw new AlmacenError(`Solo se pueden anular transferencias en tránsito (Estado actual: ${actual.estado})`, 400);
    }

    await db.transaction(async (tx) => {
      // Revertir stock al almacén de origen
      for (const item of actual.items || []) {
        await tx
          .update(almacenStock)
          .set({
            cantidad: sql`${almacenStock.cantidad} + ${item.cantidad_enviada}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(almacenStock.almacen_id, actual.almacen_origen_id),
              eq(almacenStock.lote_id, item.lote_id)
            )
          );

        // Buscar movimiento original en kardex para enlazar la anulación
        const [movOriginal] = await tx
          .select({
            id: almacenMovimientos.id,
            sede_id: almacenMovimientos.sede_id,
            almacen_id: almacenMovimientos.almacen_id,
            personal_id: almacenMovimientos.personal_id,
            cantidad: almacenMovimientos.cantidad,
          })
          .from(almacenMovimientos)
          .where(
            and(
              eq(almacenMovimientos.documento_tipo, 'TRANSFERENCIA'),
              eq(almacenMovimientos.documento_id, actual.id),
              eq(almacenMovimientos.producto_id, item.producto_id),
              eq(almacenMovimientos.lote_id, item.lote_id)
            )
          )
          .limit(1);

        if (movOriginal) {
          await tx.insert(almacenMovimientos).values({
            tipo: 'ANULACION',
            sede_id: movOriginal.sede_id,
            almacen_id: movOriginal.almacen_id,
            personal_id: movOriginal.personal_id,
            producto_id: item.producto_id,
            lote_id: item.lote_id,
            cantidad: movOriginal.cantidad,
            documento_tipo: 'TRANSFERENCIA',
            documento_id: actual.id,
            anula_movimiento_id: movOriginal.id,
            observacion: `Anulación: ${data.motivo.trim()}`,
            usuario_id: usuarioId,
          });
        }
      }

      await tx
        .update(almacenTransferencias)
        .set({
          estado: 'ANULADA',
          motivo_anulacion: data.motivo,
          usuario_anulacion_id: usuarioId,
          fecha_anulacion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenTransferencias.id, id));
    });

    return this.obtener(id);
  }
}

export const transferenciasService = new AlmacenTransferenciasService();
