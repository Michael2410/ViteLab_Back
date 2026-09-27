import { eq, desc, sql } from 'drizzle-orm';
import { db, personalHistorialLaboral, personalMotivosCese, usuarios } from '../../../db';
import { HistorialLaboralItem, RegistrarEventoHistorialDTO } from './historial.types';

export class HistorialLaboralService {
  /**
   * Obtener todo el historial de eventos laborales de un colaborador cronológicamente (más recientes primero)
   */
  async getByPersonalId(personalId: number): Promise<HistorialLaboralItem[]> {
    const rows = await db
      .select({
        id: personalHistorialLaboral.id,
        personal_id: personalHistorialLaboral.personal_id,
        tipo_evento: personalHistorialLaboral.tipo_evento,
        fecha_evento: sql<string>`TO_CHAR(${personalHistorialLaboral.fecha_evento}, 'YYYY-MM-DD')`,
        cargo: personalHistorialLaboral.cargo,
        area: personalHistorialLaboral.area,
        tipo_contrato: personalHistorialLaboral.tipo_contrato,
        sueldo_base: personalHistorialLaboral.sueldo_base,
        motivo_cese_id: personalHistorialLaboral.motivo_cese_id,
        motivo_cese_texto: sql<string>`COALESCE(${personalMotivosCese.nombre}, ${personalHistorialLaboral.motivo_cese_texto})`,
        observaciones: personalHistorialLaboral.observaciones,
        usuario_id: personalHistorialLaboral.usuario_id,
        usuario_nombre: usuarios.username,
        created_at: personalHistorialLaboral.created_at,
      })
      .from(personalHistorialLaboral)
      .leftJoin(
        personalMotivosCese,
        eq(personalHistorialLaboral.motivo_cese_id, personalMotivosCese.id)
      )
      .leftJoin(usuarios, eq(personalHistorialLaboral.usuario_id, usuarios.id))
      .where(eq(personalHistorialLaboral.personal_id, personalId))
      .orderBy(
        desc(personalHistorialLaboral.fecha_evento),
        desc(personalHistorialLaboral.id)
      );

    return rows as any;
  }

  /**
   * Registrar manualmente un evento en la auditoría laboral
   */
  async registrarEvento(
    data: RegistrarEventoHistorialDTO,
    usuarioId?: number | null
  ): Promise<HistorialLaboralItem> {
    const [inserted] = await db
      .insert(personalHistorialLaboral)
      .values({
        personal_id: data.personal_id,
        tipo_evento: data.tipo_evento,
        fecha_evento: data.fecha_evento,
        cargo: data.cargo || null,
        area: data.area || null,
        tipo_contrato: data.tipo_contrato || null,
        sueldo_base: data.sueldo_base != null ? String(data.sueldo_base) : null,
        motivo_cese_id: data.motivo_cese_id || null,
        motivo_cese_texto: data.motivo_cese_texto || null,
        observaciones: data.observaciones || null,
        usuario_id: usuarioId || null,
      })
      .returning();

    const items = await this.getByPersonalId(data.personal_id);
    return items.find((i) => i.id === inserted.id) || (inserted as any);
  }
}

export const historialLaboralService = new HistorialLaboralService();
