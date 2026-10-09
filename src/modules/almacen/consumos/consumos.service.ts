import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL, count } from 'drizzle-orm';
import {
  db,
  almacenConsumos,
  almacenConsumoDetalle,
  almacenDevoluciones,
  almacenDevolucionDetalle,
  almacenAlmacenes,
  almacenProductos,
  almacenLotes,
  almacenUnidadesMedida,
  almacenStock,
  almacenStockCustodia,
  almacenMovimientos,
  personal,
  usuarios,
  areas,
  sedes,
} from '../../../db';
import { AlmacenError } from '../shared/almacen.errors';
import { obtenerSiguienteCorrelativo } from '../shared/almacen.correlativo';
import type { Paginado } from '../shared/almacen.types';
import type {
  CrearConsumoInput,
  AnularConsumoInput,
  ListarConsumosQuery,
  CrearDevolucionInput,
  AnularDevolucionInput,
  ListarDevolucionesQuery,
} from './consumos.schema';
import type { AlmacenConsumoCompleto, AlmacenDevolucionCompleta, ItemConsumoDetalle, ItemDevolucionDetalle } from './consumos.types';

export class AlmacenConsumosService {
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

  // ==========================================
  // CONSUMOS
  // ==========================================

  async listarConsumos(
    f: ListarConsumosQuery,
    usuarioId: number,
    puedeVerTodoElPersonal: boolean,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenConsumoCompleto>> {
    let targetPersonalId = f.personal_id;
    if (!puedeVerTodoElPersonal) {
      targetPersonalId = await this.resolverPersonalId(usuarioId, undefined).catch(() => -1);
    }

    const conditions: (SQL | undefined)[] = [];

    if (f.sede_id) conditions.push(eq(almacenConsumos.sede_id, f.sede_id));
    if (targetPersonalId) conditions.push(eq(almacenConsumos.personal_id, targetPersonalId));
    if (f.estado) conditions.push(eq(almacenConsumos.estado, f.estado));
    if (f.fecha_desde) conditions.push(gte(almacenConsumos.fecha, `${f.fecha_desde} 00:00:00`));
    if (f.fecha_hasta) conditions.push(lte(almacenConsumos.fecha, `${f.fecha_hasta} 23:59:59`));

    if (sedesPermitidas !== undefined) {
      if (sedesPermitidas.length === 0) {
        return { items: [], total: 0, page: f.page, limit: f.limit, totalPages: 0 };
      }
      conditions.push(inArray(almacenConsumos.sede_id, sedesPermitidas));
    }

    if (f.search) {
      const s = `%${f.search}%`;
      conditions.push(
        or(
          ilike(almacenConsumos.numero, s),
          ilike(personal.nombres, s),
          ilike(personal.apellidos, s),
          ilike(personal.numero_documento, s)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenConsumos)
      .innerJoin(personal, eq(almacenConsumos.personal_id, personal.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenConsumos.id,
        numero: almacenConsumos.numero,
        sede_id: almacenConsumos.sede_id,
        personal_id: almacenConsumos.personal_id,
        area_id: almacenConsumos.area_id,
        fecha: almacenConsumos.fecha,
        observaciones: almacenConsumos.observaciones,
        estado: almacenConsumos.estado,
        motivo_anulacion: almacenConsumos.motivo_anulacion,
        usuario_registro_id: almacenConsumos.usuario_registro_id,
        usuario_anulacion_id: almacenConsumos.usuario_anulacion_id,
        fecha_anulacion: almacenConsumos.fecha_anulacion,
        created_at: almacenConsumos.created_at,
        updated_at: almacenConsumos.updated_at,
        sede_nombre: sedes.nombre,
        personal_nombres: personal.nombres,
        personal_apellidos: personal.apellidos,
        personal_documento: personal.numero_documento,
        area_nombre: areas.nombre,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenConsumos)
      .innerJoin(sedes, eq(almacenConsumos.sede_id, sedes.id))
      .innerJoin(personal, eq(almacenConsumos.personal_id, personal.id))
      .leftJoin(areas, eq(almacenConsumos.area_id, areas.id))
      .leftJoin(usuarios, eq(almacenConsumos.usuario_registro_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenConsumos.created_at))
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

  async obtenerConsumo(id: number): Promise<AlmacenConsumoCompleto> {
    const [c] = await db
      .select({
        id: almacenConsumos.id,
        numero: almacenConsumos.numero,
        sede_id: almacenConsumos.sede_id,
        personal_id: almacenConsumos.personal_id,
        area_id: almacenConsumos.area_id,
        fecha: almacenConsumos.fecha,
        observaciones: almacenConsumos.observaciones,
        estado: almacenConsumos.estado,
        motivo_anulacion: almacenConsumos.motivo_anulacion,
        usuario_registro_id: almacenConsumos.usuario_registro_id,
        usuario_anulacion_id: almacenConsumos.usuario_anulacion_id,
        fecha_anulacion: almacenConsumos.fecha_anulacion,
        created_at: almacenConsumos.created_at,
        updated_at: almacenConsumos.updated_at,
        sede_nombre: sedes.nombre,
        personal_nombres: personal.nombres,
        personal_apellidos: personal.apellidos,
        personal_documento: personal.numero_documento,
        area_nombre: areas.nombre,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenConsumos)
      .innerJoin(sedes, eq(almacenConsumos.sede_id, sedes.id))
      .innerJoin(personal, eq(almacenConsumos.personal_id, personal.id))
      .leftJoin(areas, eq(almacenConsumos.area_id, areas.id))
      .leftJoin(usuarios, eq(almacenConsumos.usuario_registro_id, usuarios.id))
      .where(eq(almacenConsumos.id, id))
      .limit(1);

    if (!c) throw new AlmacenError('Consumo no encontrado', 404);

    const itemsRows = await db
      .select({
        id: almacenConsumoDetalle.id,
        consumo_id: almacenConsumoDetalle.consumo_id,
        almacen_origen_id: almacenConsumoDetalle.almacen_origen_id,
        producto_id: almacenConsumoDetalle.producto_id,
        lote_id: almacenConsumoDetalle.lote_id,
        cantidad: almacenConsumoDetalle.cantidad,
        observacion: almacenConsumoDetalle.observacion,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        numero_lote: almacenLotes.numero_lote,
        marca: almacenLotes.marca,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
        almacen_nombre: almacenAlmacenes.nombre,
      })
      .from(almacenConsumoDetalle)
      .innerJoin(almacenAlmacenes, eq(almacenConsumoDetalle.almacen_origen_id, almacenAlmacenes.id))
      .innerJoin(almacenProductos, eq(almacenConsumoDetalle.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .innerJoin(almacenLotes, eq(almacenConsumoDetalle.lote_id, almacenLotes.id))
      .where(eq(almacenConsumoDetalle.consumo_id, id));

    const items: ItemConsumoDetalle[] = itemsRows.map((r) => ({
      ...r,
      cantidad: Number(r.cantidad),
    }));

    return { ...c, items };
  }

  async crearConsumo(
    data: CrearConsumoInput,
    usuarioId: number
  ): Promise<AlmacenConsumoCompleto> {
    const personalId = await this.resolverPersonalId(usuarioId, data.personal_id);

    const consumoCreado = await db.transaction(async (tx) => {
      const fechaNegocio = (data.fecha || new Date().toISOString()).slice(0, 10);
      const numero = await obtenerSiguienteCorrelativo(tx, 'CON', data.sede_id, fechaNegocio);

      const [consumo] = await tx
        .insert(almacenConsumos)
        .values({
          numero,
          sede_id: data.sede_id,
          personal_id: personalId,
          area_id: data.area_id,
          fecha: data.fecha || sql`CURRENT_TIMESTAMP`,
          observaciones: data.observaciones,
          usuario_registro_id: usuarioId,
        })
        .returning();

      for (const item of data.items) {
        // 1. Verificar stock en custodia
        const [custodia] = await tx
          .select({ id: almacenStockCustodia.id, cantidad: almacenStockCustodia.cantidad })
          .from(almacenStockCustodia)
          .where(
            and(
              eq(almacenStockCustodia.personal_id, personalId),
              eq(almacenStockCustodia.almacen_origen_id, item.almacen_origen_id),
              eq(almacenStockCustodia.lote_id, item.lote_id)
            )
          )
          .limit(1);

        if (!custodia || Number(custodia.cantidad) < item.cantidad) {
          throw new AlmacenError(
            `Stock en custodia insuficiente para el producto seleccionado (Disponible: ${custodia?.cantidad ?? 0}, Solicitado: ${item.cantidad})`,
            400
          );
        }

        // 2. Descontar de stock_custodia
        await tx
          .update(almacenStockCustodia)
          .set({
            cantidad: sql`${almacenStockCustodia.cantidad} - ${item.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(almacenStockCustodia.id, custodia.id));

        // 3. Registrar consumo_detalle
        await tx.insert(almacenConsumoDetalle).values({
          consumo_id: consumo.id,
          almacen_origen_id: item.almacen_origen_id,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad: item.cantidad,
          observacion: item.observacion,
        });

        // 4. Registrar en kardex / movimientos
        await tx.insert(almacenMovimientos).values({
          tipo: 'CONSUMO',
          sede_id: data.sede_id,
          almacen_id: item.almacen_origen_id,
          personal_id: personalId,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad: item.cantidad,
          documento_tipo: 'CONSUMO',
          documento_id: consumo.id,
          observacion: item.observacion || data.observaciones,
          usuario_id: usuarioId,
        });
      }

      return consumo;
    });

    return this.obtenerConsumo(consumoCreado.id);
  }

  async anularConsumo(
    id: number,
    data: AnularConsumoInput,
    usuarioId: number
  ): Promise<AlmacenConsumoCompleto> {
    const actual = await this.obtenerConsumo(id);
    if (actual.estado === 'ANULADO') throw new AlmacenError('El consumo ya se encuentra anulado', 400);

    await db.transaction(async (tx) => {
      // Revertir consumos al stock_custodia
      for (const item of actual.items || []) {
        const [custodiaExistente] = await tx
          .select({ id: almacenStockCustodia.id })
          .from(almacenStockCustodia)
          .where(
            and(
              eq(almacenStockCustodia.personal_id, actual.personal_id),
              eq(almacenStockCustodia.almacen_origen_id, item.almacen_origen_id),
              eq(almacenStockCustodia.lote_id, item.lote_id)
            )
          )
          .limit(1);

        if (custodiaExistente) {
          await tx
            .update(almacenStockCustodia)
            .set({
              cantidad: sql`${almacenStockCustodia.cantidad} + ${item.cantidad}`,
              updated_at: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(almacenStockCustodia.id, custodiaExistente.id));
        } else {
          await tx.insert(almacenStockCustodia).values({
            personal_id: actual.personal_id,
            almacen_origen_id: item.almacen_origen_id,
            producto_id: item.producto_id,
            lote_id: item.lote_id,
            cantidad: item.cantidad,
          });
        }

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
              eq(almacenMovimientos.documento_tipo, 'CONSUMO'),
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
            documento_tipo: 'CONSUMO',
            documento_id: actual.id,
            anula_movimiento_id: movOriginal.id,
            observacion: `Anulación: ${data.motivo.trim()}`,
            usuario_id: usuarioId,
          });
        }
      }

      await tx
        .update(almacenConsumos)
        .set({
          estado: 'ANULADO',
          motivo_anulacion: data.motivo,
          usuario_anulacion_id: usuarioId,
          fecha_anulacion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenConsumos.id, id));
    });

    return this.obtenerConsumo(id);
  }

  // ==========================================
  // DEVOLUCIONES
  // ==========================================

  async listarDevoluciones(
    f: ListarDevolucionesQuery,
    usuarioId: number,
    puedeVerTodoElPersonal: boolean,
    sedesPermitidas?: number[]
  ): Promise<Paginado<AlmacenDevolucionCompleta>> {
    let targetPersonalId = f.personal_id;
    if (!puedeVerTodoElPersonal) {
      targetPersonalId = await this.resolverPersonalId(usuarioId, undefined).catch(() => -1);
    }

    const conditions: (SQL | undefined)[] = [];

    if (f.almacen_id) conditions.push(eq(almacenDevoluciones.almacen_id, f.almacen_id));
    if (targetPersonalId) conditions.push(eq(almacenDevoluciones.personal_id, targetPersonalId));
    if (f.estado) conditions.push(eq(almacenDevoluciones.estado, f.estado));
    if (f.fecha_desde) conditions.push(gte(almacenDevoluciones.fecha, `${f.fecha_desde} 00:00:00`));
    if (f.fecha_hasta) conditions.push(lte(almacenDevoluciones.fecha, `${f.fecha_hasta} 23:59:59`));

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
          ilike(almacenDevoluciones.numero, s),
          ilike(personal.nombres, s),
          ilike(personal.apellidos, s),
          ilike(personal.numero_documento, s)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenDevoluciones)
      .innerJoin(almacenAlmacenes, eq(almacenDevoluciones.almacen_id, almacenAlmacenes.id))
      .innerJoin(personal, eq(almacenDevoluciones.personal_id, personal.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenDevoluciones.id,
        numero: almacenDevoluciones.numero,
        almacen_id: almacenDevoluciones.almacen_id,
        personal_id: almacenDevoluciones.personal_id,
        fecha: almacenDevoluciones.fecha,
        observaciones: almacenDevoluciones.observaciones,
        estado: almacenDevoluciones.estado,
        motivo_anulacion: almacenDevoluciones.motivo_anulacion,
        usuario_registro_id: almacenDevoluciones.usuario_registro_id,
        usuario_anulacion_id: almacenDevoluciones.usuario_anulacion_id,
        fecha_anulacion: almacenDevoluciones.fecha_anulacion,
        created_at: almacenDevoluciones.created_at,
        updated_at: almacenDevoluciones.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        personal_nombres: personal.nombres,
        personal_apellidos: personal.apellidos,
        personal_documento: personal.numero_documento,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenDevoluciones)
      .innerJoin(almacenAlmacenes, eq(almacenDevoluciones.almacen_id, almacenAlmacenes.id))
      .innerJoin(personal, eq(almacenDevoluciones.personal_id, personal.id))
      .leftJoin(usuarios, eq(almacenDevoluciones.usuario_registro_id, usuarios.id))
      .where(where)
      .orderBy(desc(almacenDevoluciones.created_at))
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

  async obtenerDevolucion(id: number): Promise<AlmacenDevolucionCompleta> {
    const [d] = await db
      .select({
        id: almacenDevoluciones.id,
        numero: almacenDevoluciones.numero,
        almacen_id: almacenDevoluciones.almacen_id,
        personal_id: almacenDevoluciones.personal_id,
        fecha: almacenDevoluciones.fecha,
        observaciones: almacenDevoluciones.observaciones,
        estado: almacenDevoluciones.estado,
        motivo_anulacion: almacenDevoluciones.motivo_anulacion,
        usuario_registro_id: almacenDevoluciones.usuario_registro_id,
        usuario_anulacion_id: almacenDevoluciones.usuario_anulacion_id,
        fecha_anulacion: almacenDevoluciones.fecha_anulacion,
        created_at: almacenDevoluciones.created_at,
        updated_at: almacenDevoluciones.updated_at,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        personal_nombres: personal.nombres,
        personal_apellidos: personal.apellidos,
        personal_documento: personal.numero_documento,
        usuario_registro_nombre: usuarios.username,
      })
      .from(almacenDevoluciones)
      .innerJoin(almacenAlmacenes, eq(almacenDevoluciones.almacen_id, almacenAlmacenes.id))
      .innerJoin(personal, eq(almacenDevoluciones.personal_id, personal.id))
      .leftJoin(usuarios, eq(almacenDevoluciones.usuario_registro_id, usuarios.id))
      .where(eq(almacenDevoluciones.id, id))
      .limit(1);

    if (!d) throw new AlmacenError('Devolución no encontrada', 404);

    const itemsRows = await db
      .select({
        id: almacenDevolucionDetalle.id,
        devolucion_id: almacenDevolucionDetalle.devolucion_id,
        producto_id: almacenDevolucionDetalle.producto_id,
        lote_id: almacenDevolucionDetalle.lote_id,
        cantidad: almacenDevolucionDetalle.cantidad,
        observacion: almacenDevolucionDetalle.observacion,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        numero_lote: almacenLotes.numero_lote,
        marca: almacenLotes.marca,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
      })
      .from(almacenDevolucionDetalle)
      .innerJoin(almacenProductos, eq(almacenDevolucionDetalle.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .innerJoin(almacenLotes, eq(almacenDevolucionDetalle.lote_id, almacenLotes.id))
      .where(eq(almacenDevolucionDetalle.devolucion_id, id));

    const items: ItemDevolucionDetalle[] = itemsRows.map((r) => ({
      ...r,
      cantidad: Number(r.cantidad),
    }));

    return { ...d, items };
  }

  async crearDevolucion(
    data: CrearDevolucionInput,
    usuarioId: number
  ): Promise<AlmacenDevolucionCompleta> {
    const personalId = await this.resolverPersonalId(usuarioId, data.personal_id);

    const [alm] = await db
      .select({ sede_id: almacenAlmacenes.sede_id })
      .from(almacenAlmacenes)
      .where(eq(almacenAlmacenes.id, data.almacen_id))
      .limit(1);

    if (!alm) throw new AlmacenError('Almacén destino no encontrado', 404);

    const devolucionCreada = await db.transaction(async (tx) => {
      const fechaNegocio = (data.fecha || new Date().toISOString()).slice(0, 10);
      const numero = await obtenerSiguienteCorrelativo(tx, 'DEV', alm.sede_id, fechaNegocio);

      const [devolucion] = await tx
        .insert(almacenDevoluciones)
        .values({
          numero,
          almacen_id: data.almacen_id,
          personal_id: personalId,
          fecha: data.fecha || sql`CURRENT_TIMESTAMP`,
          observaciones: data.observaciones,
          usuario_registro_id: usuarioId,
        })
        .returning();

      for (const item of data.items) {
        // 1. Verificar stock en custodia
        const [custodia] = await tx
          .select({ id: almacenStockCustodia.id, cantidad: almacenStockCustodia.cantidad })
          .from(almacenStockCustodia)
          .where(
            and(
              eq(almacenStockCustodia.personal_id, personalId),
              eq(almacenStockCustodia.almacen_origen_id, data.almacen_id),
              eq(almacenStockCustodia.lote_id, item.lote_id)
            )
          )
          .limit(1);

        if (!custodia || Number(custodia.cantidad) < item.cantidad) {
          throw new AlmacenError(
            `Stock en custodia insuficiente para devolver el lote seleccionado (Disponible: ${custodia?.cantidad ?? 0}, Solicitado: ${item.cantidad})`,
            400
          );
        }

        // 2. Descontar de stock_custodia
        await tx
          .update(almacenStockCustodia)
          .set({
            cantidad: sql`${almacenStockCustodia.cantidad} - ${item.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(almacenStockCustodia.id, custodia.id));

        // 3. Devolver a stock de almacén físico
        await tx
          .update(almacenStock)
          .set({
            cantidad: sql`${almacenStock.cantidad} + ${item.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(and(eq(almacenStock.almacen_id, data.almacen_id), eq(almacenStock.lote_id, item.lote_id)));

        // 4. Detalle
        await tx.insert(almacenDevolucionDetalle).values({
          devolucion_id: devolucion.id,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad: item.cantidad,
          observacion: item.observacion,
        });

        // 5. Kardex
        await tx.insert(almacenMovimientos).values({
          tipo: 'DEVOLUCION',
          sede_id: alm.sede_id,
          almacen_id: data.almacen_id,
          personal_id: personalId,
          producto_id: item.producto_id,
          lote_id: item.lote_id,
          cantidad: item.cantidad,
          documento_tipo: 'DEVOLUCION',
          documento_id: devolucion.id,
          observacion: item.observacion || data.observaciones,
          usuario_id: usuarioId,
        });
      }

      return devolucion;
    });

    return this.obtenerDevolucion(devolucionCreada.id);
  }

  async anularDevolucion(
    id: number,
    data: AnularDevolucionInput,
    usuarioId: number
  ): Promise<AlmacenDevolucionCompleta> {
    const actual = await this.obtenerDevolucion(id);
    if (actual.estado === 'ANULADO') throw new AlmacenError('La devolución ya se encuentra anulada', 400);

    await db.transaction(async (tx) => {
      for (const item of actual.items || []) {
        // Regresar a custodia
        const [custodiaExistente] = await tx
          .select({ id: almacenStockCustodia.id })
          .from(almacenStockCustodia)
          .where(
            and(
              eq(almacenStockCustodia.personal_id, actual.personal_id),
              eq(almacenStockCustodia.almacen_origen_id, actual.almacen_id),
              eq(almacenStockCustodia.lote_id, item.lote_id)
            )
          )
          .limit(1);

        if (custodiaExistente) {
          await tx
            .update(almacenStockCustodia)
            .set({
              cantidad: sql`${almacenStockCustodia.cantidad} + ${item.cantidad}`,
              updated_at: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(almacenStockCustodia.id, custodiaExistente.id));
        } else {
          await tx.insert(almacenStockCustodia).values({
            personal_id: actual.personal_id,
            almacen_origen_id: actual.almacen_id,
            producto_id: item.producto_id,
            lote_id: item.lote_id,
            cantidad: item.cantidad,
          });
        }

        // Descontar del almacén físico
        await tx
          .update(almacenStock)
          .set({
            cantidad: sql`${almacenStock.cantidad} - ${item.cantidad}`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(and(eq(almacenStock.almacen_id, actual.almacen_id), eq(almacenStock.lote_id, item.lote_id)));

        // Buscar movimiento original de devolución en kardex
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
              eq(almacenMovimientos.documento_tipo, 'DEVOLUCION'),
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
            documento_tipo: 'DEVOLUCION',
            documento_id: actual.id,
            anula_movimiento_id: movOriginal.id,
            observacion: `Anulación: ${data.motivo.trim()}`,
            usuario_id: usuarioId,
          });
        }
      }

      await tx
        .update(almacenDevoluciones)
        .set({
          estado: 'ANULADO',
          motivo_anulacion: data.motivo,
          usuario_anulacion_id: usuarioId,
          fecha_anulacion: sql`CURRENT_TIMESTAMP`,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(almacenDevoluciones.id, id));
    });

    return this.obtenerDevolucion(id);
  }
}

export const consumosService = new AlmacenConsumosService();
