import { eq, and, gte, lte, asc, desc, sql, inArray } from 'drizzle-orm';
import {
  db,
  personalAsistencia,
  personal,
  personalCargos,
  personalAreas,
  sedes,
} from '../../../db';
import {
  RegistroAsistenciaItem,
  RegistrarAsistenciaDTO,
  FiltrosAsistencia,
} from './asistencia.types';

export class AsistenciaService {
  /**
   * Obtener registros de asistencia con filtros y datos de colaborador
   */
  async getAllAsistencia(filtros: FiltrosAsistencia = {}): Promise<RegistroAsistenciaItem[]> {
    const conditions = [];

    if (filtros.fecha) {
      conditions.push(eq(personalAsistencia.fecha, filtros.fecha));
    }

    if (filtros.fecha_desde) {
      conditions.push(gte(personalAsistencia.fecha, filtros.fecha_desde));
    }

    if (filtros.fecha_hasta) {
      conditions.push(lte(personalAsistencia.fecha, filtros.fecha_hasta));
    }

    if (filtros.personal_id) {
      conditions.push(eq(personalAsistencia.personal_id, filtros.personal_id));
    }

    if (filtros.estado) {
      if (Array.isArray(filtros.estado)) {
        if (filtros.estado.length === 1) {
          conditions.push(eq(personalAsistencia.estado, filtros.estado[0] as any));
        } else if (filtros.estado.length > 1) {
          conditions.push(inArray(personalAsistencia.estado, filtros.estado as any[]));
        }
      } else {
        conditions.push(eq(personalAsistencia.estado, filtros.estado as any));
      }
    }

    if (filtros.search) {
      const s = `%${filtros.search}%`;
      conditions.push(
        sql`(${personal.nombres} ILIKE ${s} OR ${personal.apellidos} ILIKE ${s} OR ${personal.numero_documento} ILIKE ${s} OR COALESCE(${personalCargos.nombre}, ${personal.cargo}) ILIKE ${s})`
      );
    }

    const rows = await db
      .select({
        id: personalAsistencia.id,
        personal_id: personalAsistencia.personal_id,
        colaborador_nombre: sql<string>`CONCAT(${personal.apellidos}, ', ', ${personal.nombres})`,
        colaborador_documento: personal.numero_documento,
        cargo: sql<string>`COALESCE(${personalCargos.nombre}, ${personal.cargo}, 'General')`,
        area: sql<string>`COALESCE(${personalAreas.nombre}, ${personal.area}, 'Operaciones')`,
        fecha: sql<string>`TO_CHAR(${personalAsistencia.fecha}, 'YYYY-MM-DD')`,
        hora_entrada: personalAsistencia.hora_entrada,
        hora_salida: personalAsistencia.hora_salida,
        minutos_tardanza: personalAsistencia.minutos_tardanza,
        estado: personalAsistencia.estado,
        justificacion: personalAsistencia.justificacion,
        sede_id: personalAsistencia.sede_id,
        sede_nombre: sql<string>`COALESCE(${sedes.nombre}, 'Sede Principal')`,
        created_at: personalAsistencia.created_at,
        updated_at: personalAsistencia.updated_at,
      })
      .from(personalAsistencia)
      .innerJoin(personal, eq(personalAsistencia.personal_id, personal.id))
      .leftJoin(personalCargos, eq(personal.cargo_id, personalCargos.id))
      .leftJoin(personalAreas, eq(personal.area_id, personalAreas.id))
      .leftJoin(sedes, eq(personalAsistencia.sede_id, sedes.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(personalAsistencia.fecha), asc(personalAsistencia.hora_entrada));

    return rows as any;
  }

  /**
   * Registrar o actualizar registro de asistencia diario para un colaborador
   */
  async registrarAsistencia(
    data: RegistrarAsistenciaDTO,
    usuarioRegistroId?: number
  ): Promise<RegistroAsistenciaItem> {
    const [inserted] = await db
      .insert(personalAsistencia)
      .values({
        personal_id: data.personal_id,
        fecha: data.fecha,
        hora_entrada: data.hora_entrada || null,
        hora_salida: data.hora_salida || null,
        minutos_tardanza: data.minutos_tardanza || 0,
        estado: data.estado,
        justificacion: data.justificacion || null,
        sede_id: data.sede_id || null,
        usuario_registro_id: usuarioRegistroId || null,
      })
      .onConflictDoUpdate({
        target: [personalAsistencia.fecha, personalAsistencia.personal_id],
        set: {
          hora_entrada: sql`COALESCE(EXCLUDED.hora_entrada, ${personalAsistencia.hora_entrada})`,
          hora_salida: sql`COALESCE(EXCLUDED.hora_salida, ${personalAsistencia.hora_salida})`,
          minutos_tardanza: sql`EXCLUDED.minutos_tardanza`,
          estado: sql`EXCLUDED.estado`,
          justificacion: sql`EXCLUDED.justificacion`,
          sede_id: sql`COALESCE(EXCLUDED.sede_id, ${personalAsistencia.sede_id})`,
          usuario_registro_id: sql`COALESCE(EXCLUDED.usuario_registro_id, ${personalAsistencia.usuario_registro_id})`,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        },
      })
      .returning({ id: personalAsistencia.id });

    const items = await this.getAllAsistencia({
      personal_id: data.personal_id,
      fecha: data.fecha,
    });
    return items[0];
  }

  /**
   * Actualizar / rectificar un registro de asistencia existente por su ID
   */
  async updateAsistencia(
    id: number,
    data: Partial<RegistrarAsistenciaDTO>,
    usuarioRegistroId?: number
  ): Promise<RegistroAsistenciaItem | null> {
    const updateData: Partial<typeof personalAsistencia.$inferInsert> = {
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (data.hora_entrada !== undefined) updateData.hora_entrada = data.hora_entrada || null;
    if (data.hora_salida !== undefined) updateData.hora_salida = data.hora_salida || null;
    if (data.minutos_tardanza !== undefined) {
      updateData.minutos_tardanza = data.minutos_tardanza ?? 0;
    }
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.justificacion !== undefined) updateData.justificacion = data.justificacion || null;
    if (data.sede_id !== undefined) updateData.sede_id = data.sede_id || null;
    if (data.fecha !== undefined) updateData.fecha = data.fecha;
    if (usuarioRegistroId) updateData.usuario_registro_id = usuarioRegistroId;

    const [updated] = await db
      .update(personalAsistencia)
      .set(updateData)
      .where(eq(personalAsistencia.id, id))
      .returning({
        id: personalAsistencia.id,
        personal_id: personalAsistencia.personal_id,
        fecha: sql<string>`TO_CHAR(${personalAsistencia.fecha}, 'YYYY-MM-DD')`,
      });

    if (!updated) return null;

    const items = await this.getAllAsistencia({
      personal_id: updated.personal_id,
      fecha: updated.fecha,
    });
    return items.find((i) => i.id === id) || items[0];
  }

  /**
   * Eliminar un registro de asistencia
   */
  async deleteAsistencia(id: number): Promise<boolean> {
    const rows = await db
      .delete(personalAsistencia)
      .where(eq(personalAsistencia.id, id))
      .returning({ id: personalAsistencia.id });

    return rows.length > 0;
  }
}

export const asistenciaService = new AsistenciaService();
