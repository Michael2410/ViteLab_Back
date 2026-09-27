import { eq, and, desc, count, sql, aliasedTable } from 'drizzle-orm';
import {
  db,
  personalDocumentos,
  personal,
  personalCargos,
  usuarios,
} from '../../../db';
import {
  DocumentoLaboralItem,
  GenerarDocumentoDTO,
  FiltrosDocumentos,
} from './documentos.types';

export class DocumentosService {
  /**
   * Listar todos los documentos laborales emitidos
   */
  async getAllDocumentos(filtros: FiltrosDocumentos = {}): Promise<DocumentoLaboralItem[]> {
    const conditions = [];

    if (filtros.personal_id) {
      conditions.push(eq(personalDocumentos.personal_id, filtros.personal_id));
    }

    if (filtros.tipo_documento) {
      conditions.push(eq(personalDocumentos.tipo_documento, filtros.tipo_documento));
    }

    if (filtros.search) {
      const s = `%${filtros.search}%`;
      conditions.push(
        sql`(${personal.nombres} ILIKE ${s} OR ${personal.apellidos} ILIKE ${s} OR ${personal.numero_documento} ILIKE ${s} OR ${personalDocumentos.codigo_emision} ILIKE ${s} OR ${personalDocumentos.destinatario} ILIKE ${s})`
      );
    }

    const pu = aliasedTable(personal, 'pu');

    const rows = await db
      .select({
        id: personalDocumentos.id,
        personal_id: personalDocumentos.personal_id,
        colaborador_nombre: sql<string>`CONCAT(${personal.apellidos}, ', ', ${personal.nombres})`,
        colaborador_documento: personal.numero_documento,
        tipo_documento: personalDocumentos.tipo_documento,
        codigo_emision: personalDocumentos.codigo_emision,
        fecha_emision: sql<string>`TO_CHAR(${personalDocumentos.fecha_emision}, 'YYYY-MM-DD')`,
        destinatario: personalDocumentos.destinatario,
        cargo_consignado: personalDocumentos.cargo_consignado,
        remuneracion_consignada: personalDocumentos.remuneracion_consignada,
        archivo_url: personalDocumentos.archivo_url,
        observaciones: personalDocumentos.observaciones,
        emitido_por_id: personalDocumentos.emitido_por_id,
        emitido_por_nombre: sql<string>`COALESCE(NULLIF(TRIM(CONCAT(${pu.nombres}, ' ', ${pu.apellidos})), ''), ${usuarios.username}, 'Dirección de RRHH')`,
        created_at: personalDocumentos.created_at,
      })
      .from(personalDocumentos)
      .innerJoin(personal, eq(personalDocumentos.personal_id, personal.id))
      .leftJoin(usuarios, eq(personalDocumentos.emitido_por_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(personalDocumentos.created_at));

    return rows as any;
  }

  /**
   * Obtener documento por ID
   */
  async getDocumentoById(id: number): Promise<DocumentoLaboralItem | null> {
    const pu = aliasedTable(personal, 'pu');

    const [row] = await db
      .select({
        id: personalDocumentos.id,
        personal_id: personalDocumentos.personal_id,
        colaborador_nombre: sql<string>`CONCAT(${personal.apellidos}, ', ', ${personal.nombres})`,
        colaborador_documento: personal.numero_documento,
        tipo_documento: personalDocumentos.tipo_documento,
        codigo_emision: personalDocumentos.codigo_emision,
        fecha_emision: sql<string>`TO_CHAR(${personalDocumentos.fecha_emision}, 'YYYY-MM-DD')`,
        destinatario: personalDocumentos.destinatario,
        cargo_consignado: personalDocumentos.cargo_consignado,
        remuneracion_consignada: personalDocumentos.remuneracion_consignada,
        archivo_url: personalDocumentos.archivo_url,
        observaciones: personalDocumentos.observaciones,
        emitido_por_id: personalDocumentos.emitido_por_id,
        emitido_por_nombre: sql<string>`COALESCE(NULLIF(TRIM(CONCAT(${pu.nombres}, ' ', ${pu.apellidos})), ''), ${usuarios.username}, 'Dirección de RRHH')`,
        created_at: personalDocumentos.created_at,
      })
      .from(personalDocumentos)
      .innerJoin(personal, eq(personalDocumentos.personal_id, personal.id))
      .leftJoin(usuarios, eq(personalDocumentos.emitido_por_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(eq(personalDocumentos.id, id));

    return (row as any) || null;
  }

  /**
   * Generar y registrar una nueva constancia o certificado laboral
   */
  async generarDocumento(
    data: GenerarDocumentoDTO,
    emitidoPorId?: number
  ): Promise<DocumentoLaboralItem> {
    // 1. Obtener datos del colaborador
    const [colab] = await db
      .select({
        id: personal.id,
        nombres: personal.nombres,
        apellidos: personal.apellidos,
        numero_documento: personal.numero_documento,
        sueldo: personal.sueldo_base,
        cargo: sql<string>`COALESCE(${personalCargos.nombre}, ${personal.cargo})`,
        sueldo_actual: sql<string>`COALESCE(
          (SELECT sueldo_pactado FROM personal_contratos WHERE personal_id = ${personal.id} AND estado = 'VIGENTE' LIMIT 1),
          ${personal.sueldo_base},
          0
        )`,
      })
      .from(personal)
      .leftJoin(personalCargos, eq(personal.cargo_id, personalCargos.id))
      .where(eq(personal.id, data.personal_id));

    if (!colab) {
      throw new Error('Colaborador no encontrado');
    }

    // 2. Generar correlativo
    const anioActual = new Date().getFullYear();
    const prefijo =
      data.tipo_documento === 'CONSTANCIA_TRABAJO'
        ? 'CT'
        : data.tipo_documento === 'CERTIFICADO_LABORAL'
        ? 'CL'
        : 'DOC';

    const [countRes] = await db
      .select({ count: count() })
      .from(personalDocumentos)
      .where(
        and(
          eq(personalDocumentos.tipo_documento, data.tipo_documento),
          sql`EXTRACT(YEAR FROM ${personalDocumentos.fecha_emision}) = ${anioActual}`
        )
      );

    const correlativo = Number(countRes?.count || 0) + 1;
    const codigoEmision = `${prefijo}-${anioActual}-${String(correlativo).padStart(4, '0')}`;

    // 3. Monto de remuneración
    const remuneracion = data.incluir_remuneracion ? Number(colab.sueldo_actual) || null : null;

    // 4. Insertar documento
    const [inserted] = await db
      .insert(personalDocumentos)
      .values({
        personal_id: data.personal_id,
        tipo_documento: data.tipo_documento,
        codigo_emision: codigoEmision,
        fecha_emision: sql`CURRENT_DATE` as any,
        destinatario: data.destinatario || 'A quien corresponda',
        cargo_consignado: colab.cargo || 'Colaborador',
        remuneracion_consignada: remuneracion != null ? String(remuneracion) : null,
        observaciones: data.observaciones || null,
        emitido_por_id: emitidoPorId || null,
      })
      .returning({ id: personalDocumentos.id });

    const documento = await this.getDocumentoById(inserted.id);
    return documento!;
  }

  /**
   * Eliminar registro de documento
   */
  async deleteDocumento(id: number): Promise<boolean> {
    const rows = await db
      .delete(personalDocumentos)
      .where(eq(personalDocumentos.id, id))
      .returning({ id: personalDocumentos.id });

    return rows.length > 0;
  }
}

export const documentosService = new DocumentosService();
