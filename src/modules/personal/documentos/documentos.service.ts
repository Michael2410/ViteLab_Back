import { eq, and, desc, count, sql, aliasedTable } from 'drizzle-orm';
import {
  db,
  personalDocumentos,
  personal,
  personalCargos,
  personalAreas,
  usuarios,
  personalPlantillasDocumentos,
  configuracionSistema,
} from '../../../db';
import {
  DocumentoLaboralItem,
  GenerarDocumentoDTO,
  FiltrosDocumentos,
} from './documentos.types';
import { plantillasService } from './plantillas.service';

function fechaEnEspanolFormal(fechaStr: string | Date | null | undefined): string {
  if (!fechaStr) return '';
  // Si viene YYYY-MM-DD
  const partes = String(fechaStr).split('T')[0].split('-');
  if (partes.length === 3) {
    const anio = partes[0];
    const mesIndex = parseInt(partes[1], 10) - 1;
    const dia = partes[2].padStart(2, '0');
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    if (mesIndex >= 0 && mesIndex < 12) {
      return `${dia} de ${meses[mesIndex]} del ${anio}`;
    }
  }
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return '';
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${String(d.getDate()).padStart(2, '0')} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
}

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
        contenido_renderizado: personalDocumentos.contenido_renderizado,
        plantilla_id: personalDocumentos.plantilla_id,
        firmante_nombre: personalDocumentos.firmante_nombre,
        firmante_cargo: personalDocumentos.firmante_cargo,
        firmante_firma_url: personalDocumentos.firmante_firma_url,
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
   * Obtener documento por ID con toda su información para vista previa e impresión
   */
  async getDocumentoById(id: number): Promise<DocumentoLaboralItem | null> {
    const pu = aliasedTable(personal, 'pu');

    const rows = await db
      .select({
        id: personalDocumentos.id,
        personal_id: personalDocumentos.personal_id,
        colaborador_nombre: sql<string>`CONCAT(${personal.apellidos}, ', ', ${personal.nombres})`,
        colaborador_documento: personal.numero_documento,
        colaborador_nombres: personal.nombres,
        colaborador_apellidos: personal.apellidos,
        colaborador_num_doc: personal.numero_documento,
        colaborador_tipo_doc: personal.tipo_documento,
        colaborador_fecha_ingreso: personal.fecha_ingreso,
        colaborador_fecha_cese: personal.fecha_cese,
        colaborador_sueldo: personal.sueldo_base,
        colaborador_cargo_nom: personal.cargo,
        tipo_documento: personalDocumentos.tipo_documento,
        codigo_emision: personalDocumentos.codigo_emision,
        fecha_emision: sql<string>`TO_CHAR(${personalDocumentos.fecha_emision}, 'YYYY-MM-DD')`,
        destinatario: personalDocumentos.destinatario,
        cargo_consignado: personalDocumentos.cargo_consignado,
        remuneracion_consignada: personalDocumentos.remuneracion_consignada,
        archivo_url: personalDocumentos.archivo_url,
        observaciones: personalDocumentos.observaciones,
        contenido_renderizado: personalDocumentos.contenido_renderizado,
        plantilla_id: personalDocumentos.plantilla_id,
        firmante_nombre: personalDocumentos.firmante_nombre,
        firmante_cargo: personalDocumentos.firmante_cargo,
        firmante_firma_url: personalDocumentos.firmante_firma_url,
        emitido_por_id: personalDocumentos.emitido_por_id,
        emitido_por_nombre: sql<string>`COALESCE(NULLIF(TRIM(CONCAT(${pu.nombres}, ' ', ${pu.apellidos})), ''), ${usuarios.username}, 'Dirección de RRHH')`,
        created_at: personalDocumentos.created_at,
      })
      .from(personalDocumentos)
      .innerJoin(personal, eq(personalDocumentos.personal_id, personal.id))
      .leftJoin(usuarios, eq(personalDocumentos.emitido_por_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(eq(personalDocumentos.id, id))
      .limit(1);

    if (!rows || rows.length === 0) return null;
    const row: any = rows[0];

    // Cargar plantilla asociada (o por tipo_documento)
    let plantilla = null;
    if (row.plantilla_id) {
      plantilla = await plantillasService.getById(row.plantilla_id);
    }
    if (!plantilla) {
      plantilla = await plantillasService.getByTipo(row.tipo_documento);
    }

    // Cargar parámetros de empresa desde configuracion_sistema
    const [cfg] = await db.select().from(configuracionSistema).limit(1);

    const titulo = plantilla?.titulo_documento || (
      row.tipo_documento === 'CONSTANCIA_TRABAJO'
        ? 'CONSTANCIA DE TRABAJO'
        : row.tipo_documento === 'CERTIFICADO_LABORAL'
        ? 'CERTIFICADO DE TRABAJO'
        : 'CARTA DE PRESENTACIÓN'
    );

    const cierre = plantilla?.parrafo_cierre || 'Se expide la presente constancia a solicitud del interesado para los fines que estime conveniente.';

    // Preparar variables dinámicas con fecha actual
    const fechaActualFormal = fechaEnEspanolFormal(new Date());
    const fechaIngresoTxt = row.colaborador_fecha_ingreso ? fechaEnEspanolFormal(row.colaborador_fecha_ingreso) : 'la fecha de ingreso';
    const fechaCeseTxt = row.colaborador_fecha_cese ? fechaEnEspanolFormal(row.colaborador_fecha_cese) : fechaActualFormal;
    const sueldoTxt = row.remuneracion_consignada != null ? `S/ ${Number(row.remuneracion_consignada).toFixed(2)}` : (row.colaborador_sueldo != null ? `S/ ${Number(row.colaborador_sueldo).toFixed(2)}` : '');

    const variables: Record<string, string> = {
      empresa_nombre: cfg?.empresa_razon_social || cfg?.empresa_nombre || 'LA EMPRESA',
      empresa_razon_social: cfg?.empresa_razon_social || cfg?.empresa_nombre || 'LA EMPRESA',
      empresa_ruc: cfg?.empresa_ruc || '',
      empresa_direccion: cfg?.empresa_direccion || '',
      colaborador_nombre: `${row.colaborador_apellidos || ''}, ${row.colaborador_nombres || ''}`.trim().toUpperCase() || row.colaborador_nombre,
      colaborador_apellidos: (row.colaborador_apellidos || '').toUpperCase(),
      colaborador_nombres: (row.colaborador_nombres || '').toUpperCase(),
      colaborador_documento: `${row.colaborador_tipo_doc || 'DNI'} N° ${row.colaborador_num_doc || row.colaborador_documento || 'S/N'}`,
      colaborador_num_doc: row.colaborador_num_doc || row.colaborador_documento || 'S/N',
      colaborador_tipo_doc: row.colaborador_tipo_doc || 'DNI',
      cargo: (row.cargo_consignado || row.colaborador_cargo_nom || 'COLABORADOR').toUpperCase(),
      area: 'OPERACIONES',
      fecha_ingreso: fechaIngresoTxt,
      fecha_cese: fechaCeseTxt,
      sueldo: sueldoTxt,
      remuneracion_actual: sueldoTxt,
      fecha_emision: fechaActualFormal,
      fecha_actual: fechaActualFormal,
      ciudad_emision: plantilla?.ciudad_defecto || 'LIMA',
      destinatario: row.destinatario || 'A quien corresponda',
      firmante_nombre: row.firmante_nombre || plantilla?.firmante_nombre || 'DIRECCIÓN DE GESTIÓN HUMANA',
      firmante_cargo: row.firmante_cargo || plantilla?.firmante_cargo || 'JEFE DE RECURSOS HUMANOS',
    };

    let contenido = row.contenido_renderizado;
    if (!contenido && plantilla) {
      contenido = plantillasService.interpolarVariables(plantilla.cuerpo_template, variables);
    } else if (contenido) {
      contenido = plantillasService.interpolarVariables(contenido, variables);
    }

    return {
      ...row,
      contenido_renderizado: contenido,
      titulo_documento: titulo,
      parrafo_cierre: cierre,
      ciudad_defecto: plantilla?.ciudad_defecto || 'LIMA',
      fecha_actual_formal: fechaActualFormal,
      mostrar_logo: plantilla?.mostrar_logo ?? true,
      firmante_nombre: row.firmante_nombre || plantilla?.firmante_nombre || 'DIRECCIÓN DE GESTIÓN HUMANA',
      firmante_cargo: row.firmante_cargo || plantilla?.firmante_cargo || 'JEFE DE RECURSOS HUMANOS',
      firmante_firma_url: row.firmante_firma_url || plantilla?.firmante_firma_url || null,
      empresa_datos: {
        nombre: cfg?.empresa_nombre || 'VITELAB',
        razon_social: cfg?.empresa_razon_social || cfg?.empresa_nombre || 'VITELAB LABORATORIO CLÍNICO S.A.C.',
        ruc: cfg?.empresa_ruc || '20608945123',
        direccion: cfg?.empresa_direccion || 'Av. Principal 123 - Lima, Perú',
        telefono: cfg?.empresa_telefono || '',
        email: cfg?.empresa_email || '',
        logo_principal: cfg?.logo_principal || null,
      },
    } as any;
  }

  /**
   * Generar y registrar una nueva constancia o certificado laboral usando plantilla dinámica
   */
  async generarDocumento(
    data: GenerarDocumentoDTO,
    emitidoPorId?: number
  ): Promise<DocumentoLaboralItem> {
    // 1. Obtener datos completos del colaborador
    const [colab] = await db
      .select({
        id: personal.id,
        nombres: personal.nombres,
        apellidos: personal.apellidos,
        tipo_documento: personal.tipo_contrato, // o campo tipo doc
        numero_documento: personal.numero_documento,
        sueldo: personal.sueldo_base,
        fecha_ingreso: personal.fecha_ingreso,
        fecha_cese: personal.fecha_cese,
        cargo: sql<string>`COALESCE(${personalCargos.nombre}, ${personal.cargo}, 'COLABORADOR')`,
        area: sql<string>`COALESCE(${personalAreas.nombre}, 'OPERACIONES')`,
        sueldo_actual: sql<string>`COALESCE(
          (SELECT sueldo_pactado FROM personal_contratos WHERE personal_id = ${personal.id} AND estado = 'VIGENTE' LIMIT 1),
          ${personal.sueldo_base},
          0
        )`,
      })
      .from(personal)
      .leftJoin(personalCargos, eq(personal.cargo_id, personalCargos.id))
      .leftJoin(personalAreas, eq(personal.area_id, personalAreas.id))
      .where(eq(personal.id, data.personal_id));

    if (!colab) {
      throw new Error('Colaborador no encontrado');
    }

    // 2. Obtener plantilla activa para este tipo
    const plantilla = await plantillasService.getByTipo(data.tipo_documento);

    // 3. Obtener configuración del sistema (empresa, logo, ruc)
    const [cfg] = await db.select().from(configuracionSistema).limit(1);

    // 4. Generar correlativo
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

    // 5. Monto de remuneración
    const remuneracion = data.incluir_remuneracion ? Number(colab.sueldo_actual) || null : null;

    // 6. Preparar variables para interpolar el cuerpo
    const fechaEmisionTxt = fechaEnEspanolFormal(new Date());
    const fechaIngresoTxt = colab.fecha_ingreso ? fechaEnEspanolFormal(colab.fecha_ingreso) : 'la fecha de ingreso';
    const fechaCeseTxt = colab.fecha_cese ? fechaEnEspanolFormal(colab.fecha_cese) : fechaEmisionTxt;

    const variables: Record<string, string> = {
      empresa_nombre: cfg?.empresa_razon_social || cfg?.empresa_nombre || 'LA EMPRESA',
      empresa_ruc: cfg?.empresa_ruc || '',
      empresa_direccion: cfg?.empresa_direccion || '',
      colaborador_nombre: `${colab.apellidos}, ${colab.nombres}`.toUpperCase(),
      colaborador_apellidos: colab.apellidos.toUpperCase(),
      colaborador_nombres: colab.nombres.toUpperCase(),
      colaborador_documento: `DNI Nro. ${colab.numero_documento}`,
      cargo: colab.cargo.toUpperCase(),
      area: colab.area.toUpperCase(),
      fecha_ingreso: fechaIngresoTxt,
      fecha_cese: fechaCeseTxt,
      sueldo: remuneracion != null ? `S/ ${remuneracion.toFixed(2)}` : '',
      fecha_emision: fechaEmisionTxt,
      ciudad_emision: plantilla?.ciudad_defecto || 'LIMA',
      destinatario: data.destinatario || 'A quien corresponda',
    };

    let cuerpoRenderizado = data.contenido_personalizado?.trim();
    if (!cuerpoRenderizado && plantilla) {
      cuerpoRenderizado = plantillasService.interpolarVariables(plantilla.cuerpo_template, variables);
    } else if (!cuerpoRenderizado) {
      // Fallback predeterminado si no hubiera plantilla creada
      cuerpoRenderizado = `Por medio del presente, certificamos que el/la Sr(a). **${variables.colaborador_nombre}** identificado/a con ${variables.colaborador_documento}, labora en nuestra institución como **${variables.cargo}** en el área de **${variables.area}** desde el **${variables.fecha_ingreso}** a la fecha.`;
    }

    // 7. Insertar documento
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
        contenido_renderizado: cuerpoRenderizado,
        plantilla_id: plantilla?.id || null,
        firmante_nombre: data.firmante_nombre || plantilla?.firmante_nombre || null,
        firmante_cargo: data.firmante_cargo || plantilla?.firmante_cargo || null,
        firmante_firma_url: data.firmante_firma_url || plantilla?.firmante_firma_url || null,
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
