import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL, count } from 'drizzle-orm';
import {
  db,
  almacenAjustes,
  almacenAjusteDetalle,
  almacenAlmacenes,
  almacenProductos,
  almacenLotes,
  almacenUnidadesMedida,
  almacenStock,
  almacenMovimientos,
  usuarios,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { buildMultiFilter } from '../shared/almacen.filters';
import { obtenerSiguienteCorrelativo } from '../shared/almacen.correlativo';
import type { Paginado } from '../shared/almacen.types';
import type {
  CrearAjusteInput,
  RechazarAjusteInput,
  ListarAjustesQuery,
} from './ajustes.schema';
import type { AlmacenAjusteCompleto, ItemAjusteDetalle } from './ajustes.types';

export class AlmacenAjustesService {
  async listar(
    f: ListarAjustesQuery,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenAjusteCompleto>> {
    const conditions: (SQL | undefined)[] = [];

    const cAlmacen = buildMultiFilter(almacenAjustes.almacen_id, f.almacen_id);
    if (cAlmacen) conditions.push(cAlmacen);
    const cTipo = buildMultiFilter(almacenAjustes.tipo, f.tipo);
    if (cTipo) conditions.push(cTipo);
    const cEstado = buildMultiFilter(almacenAjustes.estado, f.estado);
    if (cEstado) conditions.push(cEstado);
    if (f.fecha_desde) conditions.push(gte(almacenAjustes.created_at, `${f.fecha_desde} 00:00:00`));
    if (f.fecha_hasta) conditions.push(lte(almacenAjustes.created_at, `${f.fecha_hasta} 23:59:59`));

    if (sedesPermitidas !== undefined) {
      if (sedesPermitidas.length === 0) {
        return { items: [], total: 0, page: f.page, limit: f.limit, totalPages: 0 };
      }
      conditions.push(inArray(almacenAlmacenes.sede_id, sedesPermitidas));
    }

    if (f.search) {
      conditions.push(ilike(almacenAjustes.numero, `%${f.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenAjustes)
      .innerJoin(almacenAlmacenes, eq(almacenAjustes.almacen_id, almacenAlmacenes.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenAjustes.id,
        numero: almacenAjustes.numero,
        almacen_id: almacenAjustes.almacen_id,
        tipo: almacenAjustes.tipo,
        motivo: almacenAjustes.motivo,
        estado: almacenAjustes.estado,
        usuario_registro_id: almacenAjustes.usuario_registro_id,
        usuario_aprobacion_id: almacenAjustes.usuario_aprobacion_id,
        fecha_aprobacion: almacenAjustes.fecha_aprobacion,
        motivo_rechazo: almacenAjustes.motivo_rechazo,
        observaciones: almacenAjustes.observaciones,
        created_at: almacenAjustes.created_at,
        updated_at: almacenAjustes.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenAjustes)
      .innerJoin(almacenAlmacenes, eq(almacenAjustes.almacen_id, almacenAlmacenes.id))
      .leftJoin(usuarios, eq(almacenAjustes.usuario_registro_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenAjustes.created_at))
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

  async obtener(id: number): Promise<AlmacenAjusteCompleto> {
    const [a] = await db
      .select({
        id: almacenAjustes.id,
        numero: almacenAjustes.numero,
        almacen_id: almacenAjustes.almacen_id,
        tipo: almacenAjustes.tipo,
        motivo: almacenAjustes.motivo,
        estado: almacenAjustes.estado,
        usuario_registro_id: almacenAjustes.usuario_registro_id,
        usuario_aprobacion_id: almacenAjustes.usuario_aprobacion_id,
        fecha_aprobacion: almacenAjustes.fecha_aprobacion,
        motivo_rechazo: almacenAjustes.motivo_rechazo,
        observaciones: almacenAjustes.observaciones,
        created_at: almacenAjustes.created_at,
        updated_at: almacenAjustes.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenAjustes)
      .innerJoin(almacenAlmacenes, eq(almacenAjustes.almacen_id, almacenAlmacenes.id))
      .leftJoin(usuarios, eq(almacenAjustes.usuario_registro_id, usuarios.id))
      .where(eq(almacenAjustes.id, id))
      .limit(1);

    if (!a) throw new AlmacenError('Ajuste no encontrado', 404);

    let usuarioAprobacionNombre: string | null = null;
    if (a.usuario_aprobacion_id) {
      const [uAprob] = await db
        .select({ username: usuarios.username })
        .from(usuarios)
        .where(eq(usuarios.id, a.usuario_aprobacion_id));
      usuarioAprobacionNombre = uAprob?.username || null;
    }

    const itemsRows = await db
      .select({
        id: almacenAjusteDetalle.id,
        ajuste_id: almacenAjusteDetalle.ajuste_id,
        producto_id: almacenAjusteDetalle.producto_id,
        lote_id: almacenAjusteDetalle.lote_id,
        cantidad: almacenAjusteDetalle.cantidad,
        sentido: almacenAjusteDetalle.sentido,
        costo_unitario: almacenAjusteDetalle.costo_unitario,
        observacion: almacenAjusteDetalle.observacion,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        unidad_medida_nombre: almacenUnidadesMedida.nombre,
        numero_lote: almacenLotes.numero_lote,
        marca: almacenLotes.marca,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
      })
      .from(almacenAjusteDetalle)
      .innerJoin(almacenProductos, eq(almacenAjusteDetalle.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .innerJoin(almacenLotes, eq(almacenAjusteDetalle.lote_id, almacenLotes.id))
      .where(eq(almacenAjusteDetalle.ajuste_id, id));

    const items: ItemAjusteDetalle[] = itemsRows.map((r) => ({
      ...r,
      cantidad: Number(r.cantidad),
      sentido: r.sentido as 'ENTRADA' | 'SALIDA',
      costo_unitario: r.costo_unitario !== null ? Number(r.costo_unitario) : null,
    }));

    return {
      ...a,
      usuario_aprobacion_nombre: usuarioAprobacionNombre,
      items,
    };
  }

  async crear(
    data: CrearAjusteInput,
    usuarioId: number
  ): Promise<AlmacenAjusteCompleto> {
    const [alm] = await db
      .select({ sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, data.almacen_id));

    if (!alm) throw new AlmacenError('Almacén no encontrado', 404);

    const ajusteCreado = await db.transaction(async (tx) => {
      const fechaNegocio = new Date().toISOString().slice(0, 10);
      const numero = await obtenerSiguienteCorrelativo(tx, 'AJU', alm.sede_id, fechaNegocio);

      const [ajuste] = await tx
        .insert(almacenAjustes)
        .values({
          numero,
          almacen_id: data.almacen_id,
          tipo: data.tipo,
          motivo: data.motivo,
          estado: 'PENDIENTE',
          usuario_registro_id: usuarioId,
          observaciones: data.observaciones,
        })
        .returning();

      for (const item of data.items) {
        await tx.insert(almacenAjusteDetalle).values({
          ajuste_id: ajuste.id,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad: item.cantidad,
          sentido: item.sentido,
          costo_unitario: item.costo_unitario || 0,
          observacion: item.observacion,
        });
      }

      return ajuste;
    });

    return this.obtener(ajusteCreado.id);
  }

  async aprobar(
    id: number,
    usuarioId: number,
    esSuperAdmin: boolean = false
  ): Promise<AlmacenAjusteCompleto> {
    const actual = await this.obtener(id);
    if (actual.estado !== 'PENDIENTE') {
      throw new AlmacenError(`No se puede aprobar un ajuste en estado ${actual.estado}`, 400);
    }

    // Principio de 4 ojos (a menos que sea super admin en pruebas)
    if (actual.usuario_registro_id === usuarioId && !esSuperAdmin) {
      throw new AlmacenError(
        'Principio de cuatro ojos: El ajuste o baja debe ser aprobado por una persona distinta a quien lo registró',
        400
      );
    }

    const [alm] = await db
      .select({ sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, actual.almacen_id));

    if (!alm) throw new AlmacenError('Almacén no encontrado', 404);

    return await db.transaction(async (tx) => {
      for (const item of actual.items || []) {
        if (item.sentido === 'SALIDA') {
          // Validar stock disponible
          const [stk] = await tx
            .select({ id: almacenStock.id, cantidad: almacenStock.cantidad })
            .from(almacenStock)
            .where(
              and(
                eq(almacenStock.almacen_id, actual.almacen_id),
                eq(almacenStock.lote_id, item.lote_id)
              )
            )
            .limit(1);

          if (!stk || Number(stk.cantidad) < item.cantidad) {
            throw new AlmacenError(
              `Stock insuficiente en almacén para aplicar la salida del lote (Disponible: ${stk?.cantidad ?? 0}, Solicitado: ${item.cantidad})`,
              400
            );
          }

          // Descontar
          await tx
            .update(almacenStock)
            .set({
              cantidad: sql`${almacenStock.cantidad} - ${item.cantidad}`,
              updated_at: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(almacenStock.id, stk.id));

          // Kardex
          await tx.insert(almacenMovimientos).values({
            tipo: 'AJUSTE_SALIDA',
            sede_id: alm.sede_id,
            almacen_id: actual.almacen_id,
            producto_id: item.producto_id,
            lote_id: item.lote_id,
            cantidad: item.cantidad,
            documento_tipo: 'AJUSTE',
            documento_id: actual.id,
            observacion: `Ajuste/Baja: ${actual.tipo} (${actual.motivo || '-'}) - ${item.observacion || ''}`,
            usuario_id: usuarioId,
          });
        } else {
          // Sentido ENTRADA
          const [stk] = await tx
            .select({ id: almacenStock.id })
            .from(almacenStock)
            .where(
              and(
                eq(almacenStock.almacen_id, actual.almacen_id),
                eq(almacenStock.lote_id, item.lote_id)
              )
            )
            .limit(1);

          if (stk) {
            await tx
              .update(almacenStock)
              .set({
                cantidad: sql`${almacenStock.cantidad} + ${item.cantidad}`,
                updated_at: sql`CURRENT_TIMESTAMP`,
              })
              .where(eq(almacenStock.id, stk.id));
          } else {
            await tx.insert(almacenStock).values({
              almacen_id: actual.almacen_id,
              producto_id: item.producto_id,
              lote_id: item.lote_id,
              cantidad: item.cantidad,
            });
          }

          // Kardex
          await tx.insert(almacenMovimientos).values({
            tipo: 'AJUSTE_ENTRADA',
            sede_id: alm.sede_id,
            almacen_id: actual.almacen_id,
            producto_id: item.producto_id,
            lote_id: item.lote_id,
            cantidad: item.cantidad,
            documento_tipo: 'AJUSTE',
            documento_id: actual.id,
            observacion: `Ajuste/Entrada: ${actual.tipo} (${actual.motivo || '-'}) - ${item.observacion || ''}`,
            usuario_id: usuarioId,
          });
        }
      }

      await tx
        .update(almacenAjustes)
        .set({
          estado: 'APROBADO',
          usuario_aprobacion_id: usuarioId,
          fecha_aprobacion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenAjustes.id, id));

      return this.obtener(id);
    });
  }

  async rechazar(
    id: number,
    data: RechazarAjusteInput,
    usuarioId: number
  ): Promise<AlmacenAjusteCompleto> {
    const actual = await this.obtener(id);
    if (actual.estado !== 'PENDIENTE') {
      throw new AlmacenError(`No se puede rechazar un ajuste en estado ${actual.estado}`, 400);
    }

    await db
      .update(almacenAjustes)
      .set({
        estado: 'RECHAZADO',
        motivo_rechazo: data.motivo,
        usuario_aprobacion_id: usuarioId,
        fecha_aprobacion: sql`CURRENT_TIMESTAMP`,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(almacenAjustes.id, id));

    return this.obtener(id);
  }
}

export const ajustesService = new AlmacenAjustesService();
