import { eq, and, asc, sql } from 'drizzle-orm';
import { db, componentes, componenteMuestras, areas, metodos, muestras } from '../../../db';
import type {
  Componente,
  CreateComponenteInput,
  UpdateComponenteInput,
} from './componentes.types';

export class ComponentesService {
  private async getMuestrasForComponente(componenteId: number): Promise<number[]> {
    const rows = await db
      .select({ muestra_id: componenteMuestras.muestra_id })
      .from(componenteMuestras)
      .where(eq(componenteMuestras.componente_id, componenteId));
    return rows.map((r) => r.muestra_id);
  }

  private async getMuestrasDetailsForComponente(
    componenteId: number
  ): Promise<Array<{ id: number; nombre: string }>> {
    return db
      .select({
        id: muestras.id,
        nombre: muestras.nombre,
      })
      .from(muestras)
      .innerJoin(componenteMuestras, eq(muestras.id, componenteMuestras.muestra_id))
      .where(eq(componenteMuestras.componente_id, componenteId));
  }

  private async syncMuestras(txOrDb: any, componenteId: number, muestrasIds: number[]): Promise<void> {
    await txOrDb
      .delete(componenteMuestras)
      .where(eq(componenteMuestras.componente_id, componenteId));

    if (muestrasIds && muestrasIds.length > 0) {
      await txOrDb.insert(componenteMuestras).values(
        muestrasIds.map((muestra_id) => ({
          componente_id: componenteId,
          muestra_id,
        }))
      );
    }
  }

  async getAll(): Promise<any[]> {
    const rows = await db
      .select({
        componente: componentes,
        area_id: areas.id,
        area_nombre: areas.nombre,
        metodo_id: metodos.id,
        metodo_nombre: metodos.nombre,
      })
      .from(componentes)
      .leftJoin(areas, eq(componentes.area_id, areas.id))
      .leftJoin(metodos, eq(componentes.metodo_id, metodos.id))
      .orderBy(asc(componentes.nombre));

    const compMuestras = await db
      .select({
        componente_id: componenteMuestras.componente_id,
        muestra_id: muestras.id,
        muestra_nombre: muestras.nombre,
      })
      .from(componenteMuestras)
      .innerJoin(muestras, eq(componenteMuestras.muestra_id, muestras.id));

    const muestrasMap = new Map<number, Array<{ id: number; nombre: string }>>();
    compMuestras.forEach((cm) => {
      if (!muestrasMap.has(cm.componente_id)) muestrasMap.set(cm.componente_id, []);
      muestrasMap.get(cm.componente_id)!.push({ id: cm.muestra_id, nombre: cm.muestra_nombre });
    });

    return rows.map((r) => {
      const mList = muestrasMap.get(r.componente.id) || [];
      return {
        ...r.componente,
        area: r.area_id ? { id: r.area_id, nombre: r.area_nombre! } : null,
        metodo: r.metodo_id ? { id: r.metodo_id, nombre: r.metodo_nombre! } : null,
        muestras: mList,
        muestras_ids: mList.map((m) => m.id),
      };
    });
  }

  async getById(id: number): Promise<any | null> {
    const [row] = await db
      .select({
        componente: componentes,
        area_id: areas.id,
        area_nombre: areas.nombre,
        metodo_id: metodos.id,
        metodo_nombre: metodos.nombre,
      })
      .from(componentes)
      .leftJoin(areas, eq(componentes.area_id, areas.id))
      .leftJoin(metodos, eq(componentes.metodo_id, metodos.id))
      .where(eq(componentes.id, id));

    if (!row) return null;

    const mDetails = await this.getMuestrasDetailsForComponente(id);

    return {
      ...row.componente,
      area: row.area_id ? { id: row.area_id, nombre: row.area_nombre! } : null,
      metodo: row.metodo_id ? { id: row.metodo_id, nombre: row.metodo_nombre! } : null,
      muestras: mDetails,
      muestras_ids: mDetails.map((m) => m.id),
    };
  }

  async getActive(): Promise<any[]> {
    const rows = await db
      .select({
        componente: componentes,
        area_id: areas.id,
        area_nombre: areas.nombre,
        metodo_id: metodos.id,
        metodo_nombre: metodos.nombre,
      })
      .from(componentes)
      .leftJoin(areas, eq(componentes.area_id, areas.id))
      .leftJoin(metodos, eq(componentes.metodo_id, metodos.id))
      .where(eq(componentes.activo, true))
      .orderBy(asc(componentes.nombre));

    const compMuestras = await db
      .select({
        componente_id: componenteMuestras.componente_id,
        muestra_id: muestras.id,
        muestra_nombre: muestras.nombre,
      })
      .from(componenteMuestras)
      .innerJoin(muestras, eq(componenteMuestras.muestra_id, muestras.id));

    const muestrasMap = new Map<number, Array<{ id: number; nombre: string }>>();
    compMuestras.forEach((cm) => {
      if (!muestrasMap.has(cm.componente_id)) muestrasMap.set(cm.componente_id, []);
      muestrasMap.get(cm.componente_id)!.push({ id: cm.muestra_id, nombre: cm.muestra_nombre });
    });

    return rows.map((r) => {
      const mList = muestrasMap.get(r.componente.id) || [];
      return {
        ...r.componente,
        area: r.area_id ? { id: r.area_id, nombre: r.area_nombre! } : null,
        metodo: r.metodo_id ? { id: r.metodo_id, nombre: r.metodo_nombre! } : null,
        muestras: mList,
        muestras_ids: mList.map((m) => m.id),
      };
    });
  }

  async create(data: CreateComponenteInput): Promise<Componente> {
    return await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(componentes)
        .values({
          nombre: data.nombre,
          valores_referenciales: data.valores_referenciales || [],
          unidad_medida: data.unidad_medida ?? null,
          area_id: data.area_id ?? null,
          metodo_id: data.metodo_id ?? null,
          valor_alerta_min: data.valor_alerta_min != null ? String(data.valor_alerta_min) : null,
          valor_alerta_max: data.valor_alerta_max != null ? String(data.valor_alerta_max) : null,
        })
        .returning();

      if (data.muestras_ids && data.muestras_ids.length > 0) {
        await this.syncMuestras(tx, inserted.id, data.muestras_ids);
      }

      return inserted;
    });
  }

  async update(id: number, data: UpdateComponenteInput): Promise<Componente | null> {
    return await db.transaction(async (tx) => {
      const updateData: Partial<typeof componentes.$inferInsert> = {
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      };

      if (data.nombre !== undefined) updateData.nombre = data.nombre;
      if (data.valores_referenciales !== undefined) {
        updateData.valores_referenciales = data.valores_referenciales;
      }
      if (data.unidad_medida !== undefined) updateData.unidad_medida = data.unidad_medida;
      if (data.area_id !== undefined) updateData.area_id = data.area_id;
      if (data.metodo_id !== undefined) updateData.metodo_id = data.metodo_id;
      if (data.valor_alerta_min !== undefined) {
        updateData.valor_alerta_min =
          data.valor_alerta_min != null ? String(data.valor_alerta_min) : null;
      }
      if (data.valor_alerta_max !== undefined) {
        updateData.valor_alerta_max =
          data.valor_alerta_max != null ? String(data.valor_alerta_max) : null;
      }
      if (data.activo !== undefined) updateData.activo = data.activo;

      if (data.muestras_ids !== undefined) {
        await this.syncMuestras(tx, id, data.muestras_ids);
      }

      const [updated] = await tx
        .update(componentes)
        .set(updateData)
        .where(eq(componentes.id, id))
        .returning();

      return updated || null;
    });
  }

  async delete(id: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx
        .delete(componenteMuestras)
        .where(eq(componenteMuestras.componente_id, id));

      const rows = await tx
        .delete(componentes)
        .where(eq(componentes.id, id))
        .returning({ id: componentes.id });

      return rows.length > 0;
    });
  }
}

export const componentesService = new ComponentesService();
