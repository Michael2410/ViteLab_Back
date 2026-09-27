import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import {
  db,
  analisis,
  componentes,
  areas,
  metodos,
  componenteMuestras,
  muestras,
} from '../../../db';
import type {
  Analisis,
  CreateAnalisisInput,
  UpdateAnalisisInput,
  AnalisisWithComponents,
} from './analisis.types';

export class AnalisisService {
  async getAll(): Promise<Analisis[]> {
    return db
      .select()
      .from(analisis)
      .orderBy(asc(analisis.nombre));
  }

  async getById(id: number): Promise<Analisis | null> {
    const [row] = await db
      .select()
      .from(analisis)
      .where(eq(analisis.id, id));
    return row || null;
  }

  async getByIdWithComponents(id: number): Promise<AnalisisWithComponents | null> {
    const [analisisItem] = await db
      .select()
      .from(analisis)
      .where(eq(analisis.id, id));

    if (!analisisItem) return null;

    let compList: any[] = [];
    const compIds = analisisItem.componentes_ids || [];

    if (compIds.length > 0) {
      const compRows = await db
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
        .where(
          and(
            inArray(componentes.id, compIds),
            eq(componentes.activo, true)
          )
        );

      const compMap = new Map(compRows.map((c) => [c.componente.id, c]));
      compList = compIds
        .map((cId) => compMap.get(cId))
        .filter(Boolean)
        .map((c) => ({
          id: c!.componente.id,
          nombre: c!.componente.nombre,
          valores_referenciales: c!.componente.valores_referenciales,
          unidad_medida: c!.componente.unidad_medida,
          area_id: c!.componente.area_id,
          metodo_id: c!.componente.metodo_id,
          activo: c!.componente.activo,
          area: c!.area_id ? { id: c!.area_id, nombre: c!.area_nombre! } : null,
          metodo: c!.metodo_id ? { id: c!.metodo_id, nombre: c!.metodo_nombre! } : null,
        }));
    }

    return {
      ...analisisItem,
      componentes: compList,
    };
  }

  async create(data: CreateAnalisisInput): Promise<Analisis> {
    const [row] = await db
      .insert(analisis)
      .values({
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        sinonimia: data.sinonimia || [],
        componentes_ids: data.componentes_ids || [],
      })
      .returning();

    return row;
  }

  async update(id: number, data: UpdateAnalisisInput): Promise<Analisis | null> {
    const updateData: Partial<typeof analisis.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.sinonimia !== undefined) updateData.sinonimia = data.sinonimia;
    if (data.componentes_ids !== undefined) updateData.componentes_ids = data.componentes_ids;
    if (data.activo !== undefined) updateData.activo = data.activo;

    const [row] = await db
      .update(analisis)
      .set(updateData)
      .where(eq(analisis.id, id))
      .returning();

    return row || null;
  }

  async delete(id: number): Promise<boolean> {
    const rows = await db
      .delete(analisis)
      .where(eq(analisis.id, id))
      .returning({ id: analisis.id });
    return rows.length > 0;
  }

  async getActive(): Promise<Analisis[]> {
    return db
      .select()
      .from(analisis)
      .where(eq(analisis.activo, true))
      .orderBy(asc(analisis.nombre));
  }

  async search(query: string): Promise<any[]> {
    const searchPattern = `%${query.toLowerCase()}%`;

    const items = await db
      .select()
      .from(analisis)
      .where(
        and(
          eq(analisis.activo, true),
          sql`(
            LOWER(${analisis.nombre}) LIKE ${searchPattern} 
            OR LOWER(${analisis.descripcion}) LIKE ${searchPattern}
            OR EXISTS (
              SELECT 1 FROM unnest(${analisis.sinonimia}) AS s WHERE LOWER(s) LIKE ${searchPattern}
            )
          )`
        )
      )
      .orderBy(asc(analisis.nombre))
      .limit(20);

    return await Promise.all(
      items.map(async (analisisItem) => {
        const compIds = analisisItem.componentes_ids || [];

        if (compIds.length > 0) {
          const compRows = await db
            .select({
              id: componentes.id,
              nombre: componentes.nombre,
              unidad_medida: componentes.unidad_medida,
              valores_referenciales: componentes.valores_referenciales,
            })
            .from(componentes)
            .where(
              and(
                inArray(componentes.id, compIds),
                eq(componentes.activo, true)
              )
            );

          const compMuestras = await db
            .select({
              componente_id: componenteMuestras.componente_id,
              id: muestras.id,
              nombre: muestras.nombre,
            })
            .from(componenteMuestras)
            .innerJoin(muestras, eq(componenteMuestras.muestra_id, muestras.id))
            .where(
              and(
                inArray(componenteMuestras.componente_id, compIds),
                eq(muestras.activo, true)
              )
            );

          const muestrasMap = new Map<number, Array<{ id: number; nombre: string }>>();
          compMuestras.forEach((cm) => {
            if (!muestrasMap.has(cm.componente_id)) muestrasMap.set(cm.componente_id, []);
            muestrasMap.get(cm.componente_id)!.push({ id: cm.id, nombre: cm.nombre });
          });

          const compMap = new Map(compRows.map((c) => [c.id, c]));
          const componentesFinal = compIds
            .map((cId) => compMap.get(cId))
            .filter(Boolean)
            .map((c) => ({
              ...c!,
              muestras: muestrasMap.get(c!.id) || [],
            }));

          return {
            ...analisisItem,
            componentes: componentesFinal,
          };
        }

        return {
          ...analisisItem,
          componentes: [],
        };
      })
    );
  }
}

export const analisisService = new AnalisisService();
