import { eq, and, gte, lte, desc, sql, aliasedTable } from 'drizzle-orm';
import {
  db,
  personalVacaciones,
  personal,
  personalCargos,
  personalAreas,
  usuarios,
} from '../../../db';
import {
  SolicitudVacacionItem,
  CreateSolicitudVacacionDTO,
  CambiarEstadoVacacionDTO,
  FiltrosVacaciones,
} from './vacaciones.types';

export class VacacionesService {
  /**
   * Listar todas las solicitudes de vacaciones con filtros y datos del colaborador
   */
  async getAllSolicitudes(filtros: FiltrosVacaciones = {}): Promise<SolicitudVacacionItem[]> {
    const conditions = [];

    if (filtros.personal_id) {
      conditions.push(eq(personalVacaciones.personal_id, filtros.personal_id));
    }

    if (filtros.estado) {
      conditions.push(eq(personalVacaciones.estado, filtros.estado));
    }

    if (filtros.fecha_desde) {
      conditions.push(gte(personalVacaciones.fecha_fin, filtros.fecha_desde));
    }

    if (filtros.fecha_hasta) {
      conditions.push(lte(personalVacaciones.fecha_inicio, filtros.fecha_hasta));
    }

    const pu = aliasedTable(personal, 'pu');

    const rows = await db
      .select({
        id: personalVacaciones.id,
        personal_id: personalVacaciones.personal_id,
        colaborador_nombre: sql<string>`CONCAT(${personal.apellidos}, ', ', ${personal.nombres})`,
        colaborador_documento: personal.numero_documento,
        colaborador_cargo: sql<string>`COALESCE(${personalCargos.nombre}, ${personal.cargo})`,
        colaborador_area: sql<string>`COALESCE(${personalAreas.nombre}, ${personal.area})`,
        fecha_inicio: sql<string>`TO_CHAR(${personalVacaciones.fecha_inicio}, 'YYYY-MM-DD')`,
        fecha_fin: sql<string>`TO_CHAR(${personalVacaciones.fecha_fin}, 'YYYY-MM-DD')`,
        dias_solicitados: personalVacaciones.dias_solicitados,
        estado: personalVacaciones.estado,
        motivo: personalVacaciones.motivo,
        observaciones_aprobador: personalVacaciones.observaciones_aprobador,
        aprobado_por_id: personalVacaciones.aprobado_por_id,
        aprobado_por_nombre: sql<string>`COALESCE(NULLIF(TRIM(CONCAT(${pu.nombres}, ' ', ${pu.apellidos})), ''), ${usuarios.username}, 'Administrador RRHH')`,
        fecha_aprobacion: sql<string>`TO_CHAR(${personalVacaciones.fecha_aprobacion}, 'YYYY-MM-DD')`,
        created_at: personalVacaciones.created_at,
        updated_at: personalVacaciones.updated_at,
      })
      .from(personalVacaciones)
      .innerJoin(personal, eq(personalVacaciones.personal_id, personal.id))
      .leftJoin(personalCargos, eq(personal.cargo_id, personalCargos.id))
      .leftJoin(personalAreas, eq(personal.area_id, personalAreas.id))
      .leftJoin(usuarios, eq(personalVacaciones.aprobado_por_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(personalVacaciones.created_at));

    return rows as any;
  }

  /**
   * Obtener una solicitud por ID
   */
  async getSolicitudById(id: number): Promise<SolicitudVacacionItem | null> {
    const pu = aliasedTable(personal, 'pu');

    const [row] = await db
      .select({
        id: personalVacaciones.id,
        personal_id: personalVacaciones.personal_id,
        colaborador_nombre: sql<string>`CONCAT(${personal.apellidos}, ', ', ${personal.nombres})`,
        colaborador_documento: personal.numero_documento,
        colaborador_cargo: sql<string>`COALESCE(${personalCargos.nombre}, ${personal.cargo})`,
        colaborador_area: sql<string>`COALESCE(${personalAreas.nombre}, ${personal.area})`,
        fecha_inicio: sql<string>`TO_CHAR(${personalVacaciones.fecha_inicio}, 'YYYY-MM-DD')`,
        fecha_fin: sql<string>`TO_CHAR(${personalVacaciones.fecha_fin}, 'YYYY-MM-DD')`,
        dias_solicitados: personalVacaciones.dias_solicitados,
        estado: personalVacaciones.estado,
        motivo: personalVacaciones.motivo,
        observaciones_aprobador: personalVacaciones.observaciones_aprobador,
        aprobado_por_id: personalVacaciones.aprobado_por_id,
        aprobado_por_nombre: sql<string>`COALESCE(NULLIF(TRIM(CONCAT(${pu.nombres}, ' ', ${pu.apellidos})), ''), ${usuarios.username}, 'Administrador RRHH')`,
        fecha_aprobacion: sql<string>`TO_CHAR(${personalVacaciones.fecha_aprobacion}, 'YYYY-MM-DD')`,
        created_at: personalVacaciones.created_at,
        updated_at: personalVacaciones.updated_at,
      })
      .from(personalVacaciones)
      .innerJoin(personal, eq(personalVacaciones.personal_id, personal.id))
      .leftJoin(personalCargos, eq(personal.cargo_id, personalCargos.id))
      .leftJoin(personalAreas, eq(personal.area_id, personalAreas.id))
      .leftJoin(usuarios, eq(personalVacaciones.aprobado_por_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(eq(personalVacaciones.id, id));

    return (row as any) || null;
  }

  /**
   * Registrar una nueva solicitud de vacaciones
   */
  async createSolicitud(data: CreateSolicitudVacacionDTO): Promise<SolicitudVacacionItem> {
    const [inserted] = await db
      .insert(personalVacaciones)
      .values({
        personal_id: data.personal_id,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
        dias_solicitados: data.dias_solicitados,
        estado: 'PENDIENTE',
        motivo: data.motivo || null,
      })
      .returning({ id: personalVacaciones.id });

    const created = await this.getSolicitudById(inserted.id);
    return created!;
  }

  /**
   * Cambiar el estado de una solicitud (Aprobar, Rechazar, Cancelar, etc.)
   */
  async cambiarEstado(
    id: number,
    data: CambiarEstadoVacacionDTO,
    aprobadorId?: number
  ): Promise<SolicitudVacacionItem | null> {
    const [updated] = await db
      .update(personalVacaciones)
      .set({
        estado: data.estado,
        observaciones_aprobador: data.observaciones_aprobador || null,
        aprobado_por_id: aprobadorId || null,
        fecha_aprobacion: sql`CURRENT_DATE` as any,
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      })
      .where(eq(personalVacaciones.id, id))
      .returning({ id: personalVacaciones.id });

    if (!updated) return null;

    return await this.getSolicitudById(id);
  }

  /**
   * Eliminar o cancelar solicitud
   */
  async deleteSolicitud(id: number): Promise<boolean> {
    const rows = await db
      .delete(personalVacaciones)
      .where(eq(personalVacaciones.id, id))
      .returning({ id: personalVacaciones.id });

    return rows.length > 0;
  }
}

export const vacacionesService = new VacacionesService();
