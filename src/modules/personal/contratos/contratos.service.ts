import { eq, and, gte, lte, isNotNull, desc, sql } from 'drizzle-orm';
import {
  db,
  personalContratos,
  personal,
  personalTiposContrato,
} from '../../../db';
import {
  ContratoItem,
  CreateContratoDTO,
  UpdateContratoDTO,
  FiltrosContratos,
} from './contratos.types';

export class ContratosService {
  /**
   * Listar todos los contratos con filtros y estado calculado
   */
  async getAllContratos(filtros: FiltrosContratos = {}): Promise<ContratoItem[]> {
    const conditions = [];

    if (filtros.personal_id) {
      conditions.push(eq(personalContratos.personal_id, filtros.personal_id));
    }

    if (filtros.estado) {
      conditions.push(eq(personalContratos.estado, filtros.estado));
    }

    if (filtros.por_vencer) {
      conditions.push(
        and(
          eq(personalContratos.es_indefinido, false),
          isNotNull(personalContratos.fecha_fin),
          eq(personalContratos.estado, 'VIGENTE'),
          gte(personalContratos.fecha_fin, sql`CURRENT_DATE`),
          lte(personalContratos.fecha_fin, sql`CURRENT_DATE + INTERVAL '30 days'`)
        )
      );
    }

    if (filtros.search) {
      const s = `%${filtros.search}%`;
      conditions.push(
        sql`(${personal.nombres} ILIKE ${s} OR ${personal.apellidos} ILIKE ${s} OR ${personal.numero_documento} ILIKE ${s} OR ${personalContratos.numero_contrato} ILIKE ${s})`
      );
    }

    const rows = await db
      .select({
        id: personalContratos.id,
        personal_id: personalContratos.personal_id,
        colaborador_nombre: sql<string>`CONCAT(${personal.apellidos}, ', ', ${personal.nombres})`,
        colaborador_documento: personal.numero_documento,
        colaborador_activo: personal.activo,
        tipo_contrato_id: personalContratos.tipo_contrato_id,
        tipo_contrato_nombre: sql<string>`COALESCE(${personalTiposContrato.nombre}, ${personalContratos.tipo_contrato_nombre})`,
        numero_contrato: personalContratos.numero_contrato,
        fecha_inicio: sql<string>`TO_CHAR(${personalContratos.fecha_inicio}, 'YYYY-MM-DD')`,
        fecha_fin: sql<string>`TO_CHAR(${personalContratos.fecha_fin}, 'YYYY-MM-DD')`,
        es_indefinido: personalContratos.es_indefinido,
        cargo: sql<string>`COALESCE(${personalContratos.cargo}, ${personal.cargo})`,
        sueldo_pactado: personalContratos.sueldo_pactado,
        archivo_url: personalContratos.archivo_url,
        estado: sql<string>`CASE 
          WHEN ${personalContratos.es_indefinido} = false AND ${personalContratos.fecha_fin} < CURRENT_DATE AND ${personalContratos.estado} = 'VIGENTE' THEN 'VENCIDO'
          WHEN ${personalContratos.es_indefinido} = false AND ${personalContratos.fecha_fin} <= CURRENT_DATE + INTERVAL '30 days' AND ${personalContratos.fecha_fin} >= CURRENT_DATE AND ${personalContratos.estado} = 'VIGENTE' THEN 'POR_VENCER'
          ELSE ${personalContratos.estado}
        END`,
        dias_restantes: sql<number | null>`CASE 
          WHEN ${personalContratos.es_indefinido} = true THEN NULL
          WHEN ${personalContratos.fecha_fin} IS NULL THEN NULL
          ELSE (${personalContratos.fecha_fin} - CURRENT_DATE)
        END`,
        observaciones: personalContratos.observaciones,
        usuario_registro_id: personalContratos.usuario_registro_id,
        created_at: personalContratos.created_at,
        updated_at: personalContratos.updated_at,
      })
      .from(personalContratos)
      .innerJoin(personal, eq(personalContratos.personal_id, personal.id))
      .leftJoin(
        personalTiposContrato,
        eq(personalContratos.tipo_contrato_id, personalTiposContrato.id)
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sql`CASE 
          WHEN ${personalContratos.estado} = 'VIGENTE' AND ${personalContratos.fecha_fin} IS NOT NULL THEN ${personalContratos.fecha_fin}
          ELSE '2099-12-31'::date
        END ASC`,
        desc(personalContratos.fecha_inicio)
      );

    return rows as any;
  }

  /**
   * Obtener contratos de un colaborador
   */
  async getByPersonalId(personalId: number): Promise<ContratoItem[]> {
    return this.getAllContratos({ personal_id: personalId });
  }

  /**
   * Obtener un contrato por ID
   */
  async getById(id: number): Promise<ContratoItem> {
    const contratos = await this.getAllContratos();
    const found = contratos.find((c) => c.id === id);
    if (!found) {
      throw new Error('Contrato no encontrado');
    }
    return found;
  }

  /**
   * Crear un nuevo contrato
   */
  async createContrato(data: CreateContratoDTO, usuarioId?: number | null): Promise<ContratoItem> {
    const newId = await db.transaction(async (tx) => {
      // Validar existencia del colaborador
      const [colaborador] = await tx
        .select()
        .from(personal)
        .where(eq(personal.id, data.personal_id));

      if (!colaborador) {
        throw new Error('Colaborador no encontrado');
      }

      // Determinar nombre del tipo de contrato si se proporcionó ID
      let tipoContratoNombre = data.tipo_contrato_nombre || null;
      if (data.tipo_contrato_id && !tipoContratoNombre) {
        const [tc] = await tx
          .select({ nombre: personalTiposContrato.nombre })
          .from(personalTiposContrato)
          .where(eq(personalTiposContrato.id, data.tipo_contrato_id));
        if (tc) tipoContratoNombre = tc.nombre;
      }

      const [inserted] = await tx
        .insert(personalContratos)
        .values({
          personal_id: data.personal_id,
          tipo_contrato_id: data.tipo_contrato_id || null,
          tipo_contrato_nombre: tipoContratoNombre,
          numero_contrato: data.numero_contrato?.trim() || null,
          fecha_inicio: data.fecha_inicio,
          fecha_fin: data.es_indefinido ? null : data.fecha_fin || null,
          es_indefinido: data.es_indefinido ?? false,
          cargo: data.cargo || colaborador.cargo || null,
          sueldo_pactado:
            data.sueldo_pactado != null
              ? String(data.sueldo_pactado)
              : colaborador.sueldo_base != null
              ? String(colaborador.sueldo_base)
              : null,
          archivo_url: data.archivo_url || null,
          estado: data.estado || 'VIGENTE',
          observaciones: data.observaciones?.trim() || null,
          usuario_registro_id: usuarioId || null,
        })
        .returning({ id: personalContratos.id });

      // Si el contrato nuevo es vigente, sincronizar en ficha principal de personal
      if ((data.estado || 'VIGENTE') === 'VIGENTE') {
        const personalUpdate: any = {
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        };
        if (data.tipo_contrato_id) personalUpdate.tipo_contrato_id = data.tipo_contrato_id;
        if (tipoContratoNombre) personalUpdate.tipo_contrato = tipoContratoNombre;
        if (data.sueldo_pactado != null) personalUpdate.sueldo_base = String(data.sueldo_pactado);
        if (data.cargo) personalUpdate.cargo = data.cargo;

        await tx
          .update(personal)
          .set(personalUpdate)
          .where(eq(personal.id, data.personal_id));
      }

      return inserted.id;
    });

    return await this.getById(newId);
  }

  /**
   * Actualizar un contrato existente
   */
  async updateContrato(id: number, data: UpdateContratoDTO): Promise<ContratoItem> {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(personalContratos)
        .where(eq(personalContratos.id, id));

      if (!existing) {
        throw new Error('Contrato no encontrado');
      }

      let tipoContratoNombre = data.tipo_contrato_nombre;
      if (data.tipo_contrato_id && !tipoContratoNombre) {
        const [tc] = await tx
          .select({ nombre: personalTiposContrato.nombre })
          .from(personalTiposContrato)
          .where(eq(personalTiposContrato.id, data.tipo_contrato_id));
        if (tc) tipoContratoNombre = tc.nombre;
      }

      const updateData: Partial<typeof personalContratos.$inferInsert> = {
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      };

      if (data.tipo_contrato_id !== undefined) updateData.tipo_contrato_id = data.tipo_contrato_id;
      if (tipoContratoNombre !== undefined) updateData.tipo_contrato_nombre = tipoContratoNombre;
      if (data.numero_contrato !== undefined) updateData.numero_contrato = data.numero_contrato;
      if (data.fecha_inicio !== undefined) updateData.fecha_inicio = data.fecha_inicio;
      if (data.es_indefinido !== undefined) {
        updateData.es_indefinido = data.es_indefinido;
        updateData.fecha_fin = data.es_indefinido ? null : data.fecha_fin;
      } else if (data.fecha_fin !== undefined) {
        updateData.fecha_fin = data.fecha_fin;
      }
      if (data.cargo !== undefined) updateData.cargo = data.cargo;
      if (data.sueldo_pactado !== undefined) {
        updateData.sueldo_pactado =
          data.sueldo_pactado != null ? String(data.sueldo_pactado) : null;
      }
      if (data.archivo_url !== undefined) updateData.archivo_url = data.archivo_url;
      if (data.estado !== undefined) updateData.estado = data.estado;
      if (data.observaciones !== undefined) updateData.observaciones = data.observaciones;

      await tx
        .update(personalContratos)
        .set(updateData)
        .where(eq(personalContratos.id, id));
    });

    return await this.getById(id);
  }

  /**
   * Eliminar o archivar un contrato
   */
  async deleteContrato(id: number): Promise<void> {
    const rows = await db
      .delete(personalContratos)
      .where(eq(personalContratos.id, id))
      .returning({ id: personalContratos.id });

    if (rows.length === 0) {
      throw new Error('Contrato no encontrado');
    }
  }

  /**
   * Renovar contrato
   */
  async renovarContrato(
    contratoAnteriorId: number,
    data: CreateContratoDTO,
    usuarioId?: number | null
  ): Promise<ContratoItem> {
    await db
      .update(personalContratos)
      .set({
        estado: 'RENOVADO',
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      })
      .where(eq(personalContratos.id, contratoAnteriorId));

    return await this.createContrato({ ...data, estado: 'VIGENTE' }, usuarioId);
  }
}

export const contratosService = new ContratosService();
