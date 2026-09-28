import { and, desc, eq, gt, ilike, inArray, or, sql, type SQL, count } from 'drizzle-orm';
import {
  db,
  almacenStockCustodia,
  almacenAlmacenes,
  almacenProductos,
  almacenLotes,
  almacenUnidadesMedida,
  personal,
  usuarios,
} from '../../../db';
import type { Paginado } from '../shared/almacen.types';
import type { ListarCustodiaQuery } from './custodia.schema';
import type { ItemCustodia, CustodiaResumen } from './custodia.types';

export class AlmacenCustodiaService {
  /**
   * Obtiene el personal_id asociado al usuario logueado.
   */
  async obtenerPersonalIdDeUsuario(usuarioId: number): Promise<number | null> {
    const [u] = await db
      .select({ personal_id: usuarios.personal_id })
      .from(usuarios)
      .where(eq(usuarios.id, usuarioId))
      .limit(1);

    return u?.personal_id || null;
  }

  async listar(
    f: ListarCustodiaQuery,
    usuarioId: number,
    puedeVerTodoElPersonal: boolean,
    sedesPermitidas?: number[]
  ): Promise<Paginado<ItemCustodia>> {
    let targetPersonalId = f.personal_id;

    if (!puedeVerTodoElPersonal) {
      // Forzar al personal_id del usuario logueado
      const miPersonalId = await this.obtenerPersonalIdDeUsuario(usuarioId);
      if (!miPersonalId) {
        return { items: [], total: 0, page: f.page, limit: f.limit, totalPages: 0 };
      }
      targetPersonalId = miPersonalId;
    }

    const conditions: (SQL | undefined)[] = [];

    if (targetPersonalId) {
      conditions.push(eq(almacenStockCustodia.personal_id, targetPersonalId));
    }

    if (f.almacen_id) {
      conditions.push(eq(almacenStockCustodia.almacen_origen_id, f.almacen_id));
    }

    if (f.solo_con_stock) {
      conditions.push(gt(almacenStockCustodia.cantidad, 0));
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
          ilike(almacenProductos.codigo, s),
          ilike(almacenProductos.nombre, s),
          ilike(almacenLotes.numero_lote, s),
          ilike(personal.nombres, s),
          ilike(personal.apellidos, s)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(almacenStockCustodia)
      .innerJoin(personal, eq(almacenStockCustodia.personal_id, personal.id))
      .innerJoin(almacenAlmacenes, eq(almacenStockCustodia.almacen_origen_id, almacenAlmacenes.id))
      .innerJoin(almacenLotes, eq(almacenStockCustodia.lote_id, almacenLotes.id))
      .innerJoin(almacenProductos, eq(almacenLotes.producto_id, almacenProductos.id))
      .where(where);

    const rows = await db
      .select({
        id: almacenStockCustodia.id,
        personal_id: almacenStockCustodia.personal_id,
        almacen_origen_id: almacenStockCustodia.almacen_origen_id,
        lote_id: almacenStockCustodia.lote_id,
        cantidad: almacenStockCustodia.cantidad,
        updated_at: almacenStockCustodia.updated_at,
        personal_nombres: personal.nombres,
        personal_apellidos: personal.apellidos,
        personal_documento: personal.numero_documento,
        almacen_nombre: almacenAlmacenes.nombre,
        sede_id: almacenAlmacenes.sede_id,
        producto_id: almacenProductos.id,
        producto_codigo: almacenProductos.codigo,
        producto_nombre: almacenProductos.nombre,
        unidad_medida_codigo: almacenUnidadesMedida.codigo,
        unidad_medida_nombre: almacenUnidadesMedida.nombre,
        numero_lote: almacenLotes.numero_lote,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
      })
      .from(almacenStockCustodia)
      .innerJoin(personal, eq(almacenStockCustodia.personal_id, personal.id))
      .innerJoin(almacenAlmacenes, eq(almacenStockCustodia.almacen_origen_id, almacenAlmacenes.id))
      .innerJoin(almacenLotes, eq(almacenStockCustodia.lote_id, almacenLotes.id))
      .innerJoin(almacenProductos, eq(almacenLotes.producto_id, almacenProductos.id))
      .innerJoin(almacenUnidadesMedida, eq(almacenProductos.unidad_medida_id, almacenUnidadesMedida.id))
      .where(where)
      .orderBy(desc(almacenStockCustodia.updated_at))
      .limit(f.limit)
      .offset((f.page - 1) * f.limit);

    const now = new Date();
    const items: ItemCustodia[] = rows.map((r) => {
      let dias: number | null = null;
      let estado: ItemCustodia['estado_vencimiento'] = 'SIN_VENCIMIENTO';

      if (r.fecha_vencimiento) {
        const fv = new Date(r.fecha_vencimiento);
        dias = Math.ceil((fv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (dias < 0) {
          estado = 'VENCIDO';
        } else if (dias <= 30) {
          estado = 'POR_VENCER';
        } else {
          estado = 'VIGENTE';
        }
      }

      return {
        ...r,
        cantidad: Number(r.cantidad),
        dias_para_vencer: dias,
        estado_vencimiento: estado,
      };
    });

    return {
      items,
      total,
      page: f.page,
      limit: f.limit,
      totalPages: Math.ceil(total / f.limit),
    };
  }

  async obtenerResumen(
    usuarioId: number,
    puedeVerTodoElPersonal: boolean,
    personalIdParam?: number,
    sedesPermitidas?: number[]
  ): Promise<CustodiaResumen> {
    let targetPersonalId = personalIdParam;
    if (!puedeVerTodoElPersonal) {
      targetPersonalId = (await this.obtenerPersonalIdDeUsuario(usuarioId)) || -1;
    }

    const conditions: (SQL | undefined)[] = [gt(almacenStockCustodia.cantidad, 0)];

    if (targetPersonalId) {
      conditions.push(eq(almacenStockCustodia.personal_id, targetPersonalId));
    }

    if (sedesPermitidas !== undefined) {
      if (sedesPermitidas.length === 0) {
        return { total_items: 0, total_unidades: 0, items_por_vencer: 0, items_vencidos: 0 };
      }
      conditions.push(inArray(almacenAlmacenes.sede_id, sedesPermitidas));
    }

    const rows = await db
      .select({
        cantidad: almacenStockCustodia.cantidad,
        fecha_vencimiento: almacenLotes.fecha_vencimiento,
      })
      .from(almacenStockCustodia)
      .innerJoin(almacenAlmacenes, eq(almacenStockCustodia.almacen_origen_id, almacenAlmacenes.id))
      .innerJoin(almacenLotes, eq(almacenStockCustodia.lote_id, almacenLotes.id))
      .where(and(...conditions));

    const now = new Date();
    let totalUnidades = 0;
    let porVencer = 0;
    let vencidos = 0;

    for (const r of rows) {
      totalUnidades += Number(r.cantidad);
      if (r.fecha_vencimiento) {
        const diff = Math.ceil((new Date(r.fecha_vencimiento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff < 0) vencidos++;
        else if (diff <= 30) porVencer++;
      }
    }

    return {
      total_items: rows.length,
      total_unidades: Math.round(totalUnidades * 100) / 100,
      items_por_vencer: porVencer,
      items_vencidos: vencidos,
    };
  }
}

export const custodiaService = new AlmacenCustodiaService();
