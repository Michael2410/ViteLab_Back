import { eq, and, inArray, count, asc, sql } from 'drizzle-orm';
import { db, configuracionSistema, sedes, ordenes } from '../../db';
import type { ConfiguracionSistema, UpdateConfiguracionInput } from './sistema.types';

class SistemaService {
  /**
   * Obtener la configuración del sistema
   * Siempre retorna el primer (y único) registro
   */
  async getConfiguracion(): Promise<ConfiguracionSistema | null> {
    const rows = await db
      .select()
      .from(configuracionSistema)
      .orderBy(asc(configuracionSistema.id))
      .limit(1);

    if (rows.length === 0) {
      // Si no existe, crear un registro por defecto
      const [insert] = await db
        .insert(configuracionSistema)
        .values({ empresa_nombre: 'LABORATORIO' })
        .returning();
      return insert;
    }

    return rows[0];
  }

  /**
   * Actualizar la configuración del sistema
   */
  async updateConfiguracion(data: UpdateConfiguracionInput): Promise<ConfiguracionSistema> {
    const existing = await this.getConfiguracion();
    let id: number;

    if (!existing) {
      const [inserted] = await db
        .insert(configuracionSistema)
        .values({ empresa_nombre: 'LABORATORIO' })
        .returning();
      id = inserted.id;
    } else {
      id = existing.id;
    }

    const { id: _, created_at: __, ...updateData } = data as any;

    const [updated] = await db
      .update(configuracionSistema)
      .set({
        ...updateData,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(configuracionSistema.id, id))
      .returning();

    return updated;
  }

  /**
   * Obtener estadísticas del dashboard por sede
   */
  async getDashboardStats(sedeIds?: number[]): Promise<{
    sedes: Array<{
      id: number;
      nombre: string;
      color: string;
      ordenes_hoy: number;
      ordenes_pendientes: number;
      ordenes_con_resultados: number;
      ordenes_aprobadas: number;
    }>;
    totales: {
      ordenes_hoy: number;
      pendientes_resultados: number;
      con_resultados: number;
      aprobadas: number;
    };
  }> {
    const colores = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa541c'];

    // Obtener sedes activas (filtradas si corresponde)
    const sedesConditions = [eq(sedes.activo, true)];
    if (sedeIds && sedeIds.length > 0) {
      sedesConditions.push(inArray(sedes.id, sedeIds));
    }

    const sedesList = await db
      .select({ id: sedes.id, nombre: sedes.nombre })
      .from(sedes)
      .where(and(...sedesConditions))
      .orderBy(asc(sedes.nombre));

    // Para cada sede, obtener estadísticas
    const sedesStats = await Promise.all(
      sedesList.map(async (sede, index) => {
        // Órdenes de hoy
        const [hoyResult] = await db
          .select({ count: count() })
          .from(ordenes)
          .where(
            and(
              eq(ordenes.sede_id, sede.id),
              sql`DATE(${ordenes.fecha_registro}) = CURRENT_DATE`
            )
          );

        // Órdenes pendientes de resultados (MUESTRA_RECIBIDA)
        const [pendientesResult] = await db
          .select({ count: count() })
          .from(ordenes)
          .where(
            and(
              eq(ordenes.sede_id, sede.id),
              eq(ordenes.estado, 'MUESTRA_RECIBIDA')
            )
          );

        // Órdenes con resultados
        const [conResultadosResult] = await db
          .select({ count: count() })
          .from(ordenes)
          .where(
            and(
              eq(ordenes.sede_id, sede.id),
              eq(ordenes.estado, 'CON_RESULTADOS')
            )
          );

        // Órdenes aprobadas listas para entrega
        const [aprobadasResult] = await db
          .select({ count: count() })
          .from(ordenes)
          .where(
            and(
              eq(ordenes.sede_id, sede.id),
              eq(ordenes.estado, 'APROBADA')
            )
          );

        return {
          id: sede.id,
          nombre: sede.nombre,
          color: colores[index % colores.length],
          ordenes_hoy: Number(hoyResult?.count || 0),
          ordenes_pendientes: Number(pendientesResult?.count || 0),
          ordenes_con_resultados: Number(conResultadosResult?.count || 0),
          ordenes_aprobadas: Number(aprobadasResult?.count || 0),
        };
      })
    );

    // Calcular totales
    const totales = sedesStats.reduce(
      (acc, sede) => ({
        ordenes_hoy: acc.ordenes_hoy + sede.ordenes_hoy,
        pendientes_resultados: acc.pendientes_resultados + sede.ordenes_pendientes,
        con_resultados: acc.con_resultados + sede.ordenes_con_resultados,
        aprobadas: acc.aprobadas + sede.ordenes_aprobadas,
      }),
      { ordenes_hoy: 0, pendientes_resultados: 0, con_resultados: 0, aprobadas: 0 }
    );

    return { sedes: sedesStats, totales };
  }
}

export const sistemaService = new SistemaService();
