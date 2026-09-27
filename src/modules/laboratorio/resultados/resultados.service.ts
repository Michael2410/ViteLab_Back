import { eq, and, inArray, desc, asc, count, sql, aliasedTable } from 'drizzle-orm';
import {
  db,
  resultados,
  ordenAnalisis,
  componentes,
  ordenes,
  pacientes,
  sedes,
  tiposCliente,
  convenios,
  analisis,
  metodos,
  usuarios,
  personal,
} from '../../../db';
import { emitEvent } from '../../../config/socket';
import { iaService, type OrdenParaIA, type AnalisisParaIA } from '../ia/ia.service';
import type {
  ResultadoDetalle,
  CreateResultadoInput,
  UpdateResultadoInput,
  BulkResultadosInput,
  ResultadosFilters,
  OrdenConResultados,
  AnalisisConComponentes,
} from './resultados.types';

class ResultadosService {
  // ============================================
  // CREAR RESULTADO INDIVIDUAL
  // ============================================

  async createResultado(
    data: CreateResultadoInput,
    usuarioId: number
  ): Promise<ResultadoDetalle> {
    const newId = await db.transaction(async (tx) => {
      // Verificar que el orden_analisis existe
      const [oaCheck] = await tx
        .select({ id: ordenAnalisis.id, orden_id: ordenAnalisis.orden_id })
        .from(ordenAnalisis)
        .where(eq(ordenAnalisis.id, data.orden_analisis_id));

      if (!oaCheck) {
        throw new Error('La orden-análisis no existe');
      }

      // Verificar que el componente existe
      const [compCheck] = await tx
        .select({ id: componentes.id })
        .from(componentes)
        .where(and(eq(componentes.id, data.componente_id), eq(componentes.activo, true)));

      if (!compCheck) {
        throw new Error('El componente no existe o está inactivo');
      }

      // Verificar si ya existe un resultado
      const [resExistente] = await tx
        .select({ id: resultados.id })
        .from(resultados)
        .where(
          and(
            eq(resultados.orden_analisis_id, data.orden_analisis_id),
            eq(resultados.componente_id, data.componente_id)
          )
        );

      if (resExistente) {
        throw new Error('Ya existe un resultado para este componente');
      }

      const [inserted] = await tx
        .insert(resultados)
        .values({
          orden_analisis_id: data.orden_analisis_id,
          componente_id: data.componente_id,
          resultado: data.valor,
          observacion: data.observaciones || null,
          usuario_registro_id: usuarioId,
        })
        .returning({ id: resultados.id });

      return inserted.id;
    });

    return await this.getResultadoById(newId);
  }

  // ============================================
  // CREAR MÚLTIPLES RESULTADOS (BULK)
  // ============================================

  async createBulkResultados(
    data: BulkResultadosInput,
    usuarioId: number
  ): Promise<{ created: number; resultados: ResultadoDetalle[] }> {
    const idsCreados: number[] = await db.transaction(async (tx) => {
      const [ordenCheck] = await tx
        .select({ id: ordenes.id, estado: ordenes.estado })
        .from(ordenes)
        .where(eq(ordenes.id, data.orden_id));

      if (!ordenCheck) {
        throw new Error('La orden no existe');
      }

      const estadosPermitidos = ['REGISTRADA', 'MUESTRA_RECIBIDA'];
      if (!estadosPermitidos.includes(ordenCheck.estado)) {
        throw new Error(
          'Solo se pueden ingresar resultados en órdenes REGISTRADAS o con MUESTRA_RECIBIDA'
        );
      }

      const createdIds: number[] = [];

      for (const resItem of data.resultados) {
        const [existe] = await tx
          .select({ id: resultados.id })
          .from(resultados)
          .where(
            and(
              eq(resultados.orden_analisis_id, resItem.orden_analisis_id),
              eq(resultados.componente_id, resItem.componente_id)
            )
          );

        if (!existe) {
          const [ins] = await tx
            .insert(resultados)
            .values({
              orden_analisis_id: resItem.orden_analisis_id,
              componente_id: resItem.componente_id,
              resultado: resItem.valor,
              observacion: resItem.observaciones || null,
              usuario_registro_id: usuarioId,
            })
            .returning({ id: resultados.id });

          createdIds.push(ins.id);
        }
      }

      // Cambiar estado a CON_RESULTADOS
      await tx
        .update(ordenes)
        .set({
          estado: 'CON_RESULTADOS',
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(ordenes.id, data.orden_id));

      return createdIds;
    });

    // Eventos Socket y generación IA
    emitEvent('orden:estado_cambiado', {
      ordenId: data.orden_id,
      estado: 'CON_RESULTADOS',
    });
    emitEvent('dashboard:update');

    this.generarInterpretacionIA(data.orden_id).catch((err) => {
      console.error('Error al generar interpretación IA en createBulkResultados:', err);
    });

    const resultadosList = await Promise.all(
      idsCreados.map((id) => this.getResultadoById(id))
    );

    return {
      created: idsCreados.length,
      resultados: resultadosList,
    };
  }

  // ============================================
  // OBTENER RESULTADO POR ID
  // ============================================

  async getResultadoById(id: number): Promise<ResultadoDetalle> {
    const pu = aliasedTable(personal, 'pu');

    const [row] = await db
      .select({
        id: resultados.id,
        orden_analisis_id: resultados.orden_analisis_id,
        componente_id: resultados.componente_id,
        valor: sql<string>`COALESCE(${resultados.resultado}, '')`,
        unidad_medida: componentes.unidad_medida,
        valor_referencia: sql<string>`COALESCE(${resultados.valor_referencial}, '')`,
        observaciones: sql<string>`COALESCE(${resultados.observacion}, '')`,
        usuario_registro_id: sql<number>`COALESCE(${resultados.usuario_registro_id}, 0)::int`,
        created_at: resultados.created_at,
        updated_at: resultados.updated_at,
        componente_nombre: componentes.nombre,
        orden_id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        analisis_nombre: analisis.nombre,
        usuario_registro_nombres: sql<string>`COALESCE(${pu.nombres}, ${usuarios.username})`,
        usuario_registro_apellidos: sql<string>`COALESCE(${pu.apellidos}, '')`,
      })
      .from(resultados)
      .innerJoin(ordenAnalisis, eq(resultados.orden_analisis_id, ordenAnalisis.id))
      .innerJoin(componentes, eq(resultados.componente_id, componentes.id))
      .innerJoin(ordenes, eq(ordenAnalisis.orden_id, ordenes.id))
      .innerJoin(analisis, eq(ordenAnalisis.analisis_id, analisis.id))
      .leftJoin(usuarios, eq(resultados.usuario_registro_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(eq(resultados.id, id));

    if (!row) {
      throw new Error('Resultado no encontrado');
    }

    return {
      id: row.id,
      orden_analisis_id: row.orden_analisis_id,
      componente_id: row.componente_id,
      valor: row.valor,
      unidad_medida: row.unidad_medida,
      valor_referencia: row.valor_referencia,
      observaciones: row.observaciones,
      usuario_registro_id: row.usuario_registro_id,
      created_at: row.created_at as any,
      updated_at: row.updated_at as any,
      componente_nombre: row.componente_nombre,
      orden_id: row.orden_id,
      numero_atencion: row.numero_atencion,
      analisis_nombre: row.analisis_nombre,
      usuario_registro_nombre: `${row.usuario_registro_nombres} ${row.usuario_registro_apellidos}`.trim(),
    };
  }

  // ============================================
  // OBTENER RESULTADOS CON FILTROS
  // ============================================

  async getResultados(filters: ResultadosFilters): Promise<ResultadoDetalle[]> {
    const conditions = [];

    if (filters.orden_id) {
      conditions.push(eq(ordenes.id, filters.orden_id));
    }
    if (filters.orden_analisis_id) {
      conditions.push(eq(resultados.orden_analisis_id, filters.orden_analisis_id));
    }
    if (filters.componente_id) {
      conditions.push(eq(resultados.componente_id, filters.componente_id));
    }

    const pu = aliasedTable(personal, 'pu');

    const rows = await db
      .select({
        id: resultados.id,
        orden_analisis_id: resultados.orden_analisis_id,
        componente_id: resultados.componente_id,
        valor: sql<string>`COALESCE(${resultados.resultado}, '')`,
        unidad_medida: componentes.unidad_medida,
        valor_referencia: sql<string>`COALESCE(${resultados.valor_referencial}, '')`,
        observaciones: sql<string>`COALESCE(${resultados.observacion}, '')`,
        usuario_registro_id: sql<number>`COALESCE(${resultados.usuario_registro_id}, 0)::int`,
        created_at: resultados.created_at,
        updated_at: resultados.updated_at,
        componente_nombre: componentes.nombre,
        orden_id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        analisis_nombre: analisis.nombre,
        usuario_registro_nombres: sql<string>`COALESCE(${pu.nombres}, ${usuarios.username})`,
        usuario_registro_apellidos: sql<string>`COALESCE(${pu.apellidos}, '')`,
      })
      .from(resultados)
      .innerJoin(ordenAnalisis, eq(resultados.orden_analisis_id, ordenAnalisis.id))
      .innerJoin(componentes, eq(resultados.componente_id, componentes.id))
      .innerJoin(ordenes, eq(ordenAnalisis.orden_id, ordenes.id))
      .innerJoin(analisis, eq(ordenAnalisis.analisis_id, analisis.id))
      .leftJoin(usuarios, eq(resultados.usuario_registro_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ordenes.fecha_registro), asc(analisis.nombre));

    return rows.map((row) => ({
      id: row.id,
      orden_analisis_id: row.orden_analisis_id,
      componente_id: row.componente_id,
      valor: row.valor,
      unidad_medida: row.unidad_medida,
      valor_referencia: row.valor_referencia,
      observaciones: row.observaciones,
      usuario_registro_id: row.usuario_registro_id,
      created_at: row.created_at as any,
      updated_at: row.updated_at as any,
      componente_nombre: row.componente_nombre,
      orden_id: row.orden_id,
      numero_atencion: row.numero_atencion,
      analisis_nombre: row.analisis_nombre,
      usuario_registro_nombre: `${row.usuario_registro_nombres} ${row.usuario_registro_apellidos}`.trim(),
    }));
  }

  // ============================================
  // OBTENER ORDEN CON TODOS SUS RESULTADOS
  // ============================================

  async getOrdenConResultados(ordenId: number): Promise<OrdenConResultados> {
    const pu = aliasedTable(personal, 'pu');

    const [ordenRow] = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        estado: ordenes.estado,
        paciente_nombres: pacientes.nombres,
        paciente_apellidos: sql<string>`CONCAT(${pacientes.apellido_paterno}, ' ', ${pacientes.apellido_materno})`,
        paciente_dni: pacientes.dni,
        paciente_genero: pacientes.genero,
        paciente_fecha_nacimiento: pacientes.fecha_nacimiento,
        fecha_registro: ordenes.fecha_registro,
        fecha_aprobacion: ordenes.fecha_aprobacion,
        sede_nombre: sedes.nombre,
        tipo_cliente_nombre: tiposCliente.nombre,
        convenio_nombre: convenios.nombre_empresa,
        convenio_direccion: convenios.direccion,
        convenio_logo_url: convenios.logo_url,
        medico: ordenes.medico,
        aprobado_por_nombres: sql<string | null>`COALESCE(${pu.nombres}, ${usuarios.username})`,
        aprobado_por_apellidos: sql<string | null>`COALESCE(${pu.apellidos}, '')`,
        aprobado_por_firma_url: pu.firma_url,
        interpretacion_ia: ordenes.interpretacion_ia,
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .innerJoin(sedes, eq(ordenes.sede_id, sedes.id))
      .innerJoin(tiposCliente, eq(ordenes.tipo_cliente_id, tiposCliente.id))
      .leftJoin(convenios, eq(ordenes.convenio_id, convenios.id))
      .leftJoin(usuarios, eq(ordenes.usuario_aprobacion_id, usuarios.id))
      .leftJoin(pu, eq(usuarios.personal_id, pu.id))
      .where(eq(ordenes.id, ordenId));

    if (!ordenRow) {
      throw new Error('Orden no encontrada');
    }

    // Análisis de la orden
    const analisisRows = await db
      .select({
        orden_analisis_id: ordenAnalisis.id,
        analisis_id: ordenAnalisis.analisis_id,
        analisis_nombre: analisis.nombre,
        componentes_ids: analisis.componentes_ids,
      })
      .from(ordenAnalisis)
      .innerJoin(analisis, eq(ordenAnalisis.analisis_id, analisis.id))
      .where(eq(ordenAnalisis.orden_id, ordenId))
      .orderBy(asc(analisis.nombre));

    // Armar componentes con resultados para cada análisis
    const analisisConComponentes: AnalisisConComponentes[] = await Promise.all(
      analisisRows.map(async (an) => {
        const cIds = an.componentes_ids || [];
        if (cIds.length === 0) {
          return {
            orden_analisis_id: an.orden_analisis_id,
            analisis_id: an.analisis_id,
            analisis_nombre: an.analisis_nombre,
            componentes: [],
          };
        }

        const compRows = await db
          .select({
            componente_id: componentes.id,
            componente_nombre: componentes.nombre,
            unidad_medida: componentes.unidad_medida,
            valores_referenciales: componentes.valores_referenciales,
            valor_alerta_min: componentes.valor_alerta_min,
            valor_alerta_max: componentes.valor_alerta_max,
            metodo_nombre: metodos.nombre,
            resultado_id: resultados.id,
            resultado_valor: resultados.resultado,
            resultado_observaciones: resultados.observacion,
          })
          .from(componentes)
          .leftJoin(metodos, eq(componentes.metodo_id, metodos.id))
          .leftJoin(
            resultados,
            and(
              eq(resultados.componente_id, componentes.id),
              eq(resultados.orden_analisis_id, an.orden_analisis_id)
            )
          )
          .where(and(inArray(componentes.id, cIds), eq(componentes.activo, true)));

        const compMap = new Map(compRows.map((c) => [c.componente_id, c]));

        const compFinal = cIds
          .map((cId) => compMap.get(cId))
          .filter(Boolean)
          .map((c) => ({
            componente_id: c!.componente_id,
            componente_nombre: c!.componente_nombre,
            unidad_medida: c!.unidad_medida,
            valores_referenciales: c!.valores_referenciales || [],
            valor_alerta_min: c!.valor_alerta_min ? parseFloat(c!.valor_alerta_min) : null,
            valor_alerta_max: c!.valor_alerta_max ? parseFloat(c!.valor_alerta_max) : null,
            metodo_nombre: c!.metodo_nombre,
            resultado_id: c!.resultado_id,
            resultado_valor: c!.resultado_valor,
            resultado_observaciones: c!.resultado_observaciones,
            tiene_resultado: c!.resultado_id !== null,
          }));

        return {
          orden_analisis_id: an.orden_analisis_id,
          analisis_id: an.analisis_id,
          analisis_nombre: an.analisis_nombre,
          componentes: compFinal,
        };
      })
    );

    return {
      id: ordenRow.id,
      numero_atencion: ordenRow.numero_atencion,
      estado: ordenRow.estado,
      paciente_nombres: ordenRow.paciente_nombres,
      paciente_apellidos: ordenRow.paciente_apellidos,
      paciente_dni: ordenRow.paciente_dni,
      paciente_genero: ordenRow.paciente_genero || undefined,
      paciente_fecha_nacimiento: ordenRow.paciente_fecha_nacimiento as any,
      fecha_registro: ordenRow.fecha_registro as any,
      fecha_aprobacion: ordenRow.fecha_aprobacion as any,
      sede_nombre: ordenRow.sede_nombre,
      tipo_cliente_nombre: ordenRow.tipo_cliente_nombre,
      convenio_nombre: ordenRow.convenio_nombre || undefined,
      convenio_direccion: ordenRow.convenio_direccion || undefined,
      convenio_logo_url: ordenRow.convenio_logo_url || undefined,
      medico: ordenRow.medico || undefined,
      aprobado_por_nombres: ordenRow.aprobado_por_nombres || undefined,
      aprobado_por_apellidos: ordenRow.aprobado_por_apellidos || undefined,
      aprobado_por_firma_url: ordenRow.aprobado_por_firma_url || undefined,
      interpretacion_ia: ordenRow.interpretacion_ia,
      analisis: analisisConComponentes,
    };
  }

  // ============================================
  // ACTUALIZAR RESULTADO
  // ============================================

  async updateResultado(id: number, data: UpdateResultadoInput): Promise<ResultadoDetalle> {
    const updateData: any = {
      updated_at: sql`CURRENT_TIMESTAMP`,
    };

    if (data.valor !== undefined) updateData.resultado = data.valor;
    if (data.observaciones !== undefined) updateData.observacion = data.observaciones || null;

    const [updated] = await db
      .update(resultados)
      .set(updateData)
      .where(eq(resultados.id, id))
      .returning({ id: resultados.id });

    if (!updated) {
      throw new Error('Resultado no encontrado');
    }

    return await this.getResultadoById(id);
  }

  // ============================================
  // ELIMINAR RESULTADO
  // ============================================

  async deleteResultado(id: number): Promise<void> {
    const rows = await db
      .delete(resultados)
      .where(eq(resultados.id, id))
      .returning({ id: resultados.id });

    if (rows.length === 0) {
      throw new Error('Resultado no encontrado');
    }
  }

  // ============================================
  // OBTENER ÓRDENES PARA RESULTADOS
  // ============================================

  async getOrdenesParaResultados(sedeIds?: number[]): Promise<any[]> {
    const conditions = [inArray(ordenes.estado, ['REGISTRADA', 'MUESTRA_RECIBIDA'])];

    if (sedeIds && sedeIds.length > 0) {
      conditions.push(inArray(ordenes.sede_id, sedeIds));
    }

    const rows = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        estado: ordenes.estado,
        fecha_registro: ordenes.fecha_registro,
        paciente_nombres: pacientes.nombres,
        paciente_apellidos: sql<string>`CONCAT(${pacientes.apellido_paterno}, ' ', ${pacientes.apellido_materno})`,
        paciente_dni: pacientes.dni,
        sede_nombre: sedes.nombre,
        tipo_cliente_nombre: tiposCliente.nombre,
        total_analisis: count(ordenAnalisis.id),
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .innerJoin(sedes, eq(ordenes.sede_id, sedes.id))
      .innerJoin(tiposCliente, eq(ordenes.tipo_cliente_id, tiposCliente.id))
      .leftJoin(ordenAnalisis, eq(ordenes.id, ordenAnalisis.orden_id))
      .where(and(...conditions))
      .groupBy(
        ordenes.id,
        ordenes.numero_atencion,
        ordenes.estado,
        ordenes.fecha_registro,
        pacientes.nombres,
        pacientes.apellido_paterno,
        pacientes.apellido_materno,
        pacientes.dni,
        sedes.nombre,
        tiposCliente.nombre
      )
      .orderBy(desc(ordenes.fecha_registro));

    return rows.map((r) => ({
      ...r,
      total_analisis: Number(r.total_analisis || 0),
    }));
  }

  // ============================================
  // OBTENER ÓRDENES PENDIENTES DE APROBACIÓN
  // ============================================

  async getOrdenesPendientesAprobacion(sedeIds?: number[]): Promise<any[]> {
    const conditions = [eq(ordenes.estado, 'CON_RESULTADOS')];

    if (sedeIds && sedeIds.length > 0) {
      conditions.push(inArray(ordenes.sede_id, sedeIds));
    }

    const rows = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        estado: ordenes.estado,
        fecha_registro: ordenes.fecha_registro,
        fecha_recepcion: ordenes.fecha_recepcion,
        paciente_nombres: pacientes.nombres,
        paciente_apellidos: sql<string>`CONCAT(${pacientes.apellido_paterno}, ' ', ${pacientes.apellido_materno})`,
        paciente_dni: pacientes.dni,
        sede_nombre: sedes.nombre,
        tipo_cliente_nombre: tiposCliente.nombre,
        convenio_nombre: convenios.nombre_empresa,
        total_analisis: count(ordenAnalisis.id),
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .innerJoin(sedes, eq(ordenes.sede_id, sedes.id))
      .innerJoin(tiposCliente, eq(ordenes.tipo_cliente_id, tiposCliente.id))
      .leftJoin(convenios, eq(ordenes.convenio_id, convenios.id))
      .leftJoin(ordenAnalisis, eq(ordenes.id, ordenAnalisis.orden_id))
      .where(and(...conditions))
      .groupBy(
        ordenes.id,
        ordenes.numero_atencion,
        ordenes.estado,
        ordenes.fecha_registro,
        ordenes.fecha_recepcion,
        pacientes.nombres,
        pacientes.apellido_paterno,
        pacientes.apellido_materno,
        pacientes.dni,
        sedes.nombre,
        tiposCliente.nombre,
        convenios.nombre_empresa
      )
      .orderBy(desc(ordenes.fecha_registro));

    return rows.map((r) => ({
      ...r,
      total_analisis: Number(r.total_analisis || 0),
    }));
  }

  // ============================================
  // APROBAR ORDEN
  // ============================================

  async aprobarOrden(
    ordenId: number,
    usuarioId: number
  ): Promise<{ message: string; orden: any }> {
    await db.transaction(async (tx) => {
      const [ordenRow] = await tx
        .select({ id: ordenes.id, estado: ordenes.estado })
        .from(ordenes)
        .where(eq(ordenes.id, ordenId));

      if (!ordenRow) {
        throw new Error('La orden no existe');
      }

      if (ordenRow.estado !== 'CON_RESULTADOS') {
        throw new Error('Solo se pueden aprobar órdenes con estado CON_RESULTADOS');
      }

      // Verificar que todos los componentes requeridos tengan resultados
      const analisisRows = await tx
        .select({
          orden_analisis_id: ordenAnalisis.id,
          componentes_ids: analisis.componentes_ids,
        })
        .from(ordenAnalisis)
        .innerJoin(analisis, eq(ordenAnalisis.analisis_id, analisis.id))
        .where(eq(ordenAnalisis.orden_id, ordenId));

      for (const an of analisisRows) {
        const cIds = an.componentes_ids || [];
        for (const cId of cIds) {
          const [resCheck] = await tx
            .select({ id: resultados.id })
            .from(resultados)
            .where(
              and(
                eq(resultados.orden_analisis_id, an.orden_analisis_id),
                eq(resultados.componente_id, cId)
              )
            );

          if (!resCheck) {
            throw new Error(
              'No se puede aprobar la orden porque faltan resultados en algunos análisis'
            );
          }
        }
      }

      // Actualizar estado a APROBADA
      await tx
        .update(ordenes)
        .set({
          estado: 'APROBADA',
          usuario_aprobacion_id: usuarioId,
          fecha_aprobacion: sql`CURRENT_TIMESTAMP` as any,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(ordenes.id, ordenId));
    });

    // Generar interpretación IA si no existe
    this.generarInterpretacionIA(ordenId).catch((err) => {
      console.error('Error al generar interpretación IA en aprobarOrden:', err);
    });

    emitEvent('orden:estado_cambiado', { ordenId, estado: 'APROBADA' });
    emitEvent('dashboard:update');

    const ordenCompleta = await this.getOrdenConResultados(ordenId);

    return {
      message: 'Orden aprobada exitosamente',
      orden: ordenCompleta,
    };
  }

  // ============================================
  // GUARDAR RESULTADOS (UPSERT)
  // ============================================

  async guardarResultados(
    data: BulkResultadosInput,
    usuarioId: number
  ): Promise<{ guardados: number; ordenEstado: string }> {
    const ordenId = data.orden_id;

    const ordenEstadoFinal = await db.transaction(async (tx) => {
      const [ordenCheck] = await tx
        .select({ id: ordenes.id, estado: ordenes.estado })
        .from(ordenes)
        .where(eq(ordenes.id, ordenId));

      if (!ordenCheck) {
        throw new Error('La orden no existe');
      }

      if (['APROBADA', 'IMPRESO'].includes(ordenCheck.estado)) {
        throw new Error('No se pueden modificar resultados de una orden ya aprobada o impresa');
      }

      for (const item of data.resultados) {
        const [existe] = await tx
          .select({ id: resultados.id })
          .from(resultados)
          .where(
            and(
              eq(resultados.orden_analisis_id, item.orden_analisis_id),
              eq(resultados.componente_id, item.componente_id)
            )
          );

        if (existe) {
          await tx
            .update(resultados)
            .set({
              resultado: item.valor,
              observacion: item.observaciones || null,
              usuario_registro_id: usuarioId,
              updated_at: sql`CURRENT_TIMESTAMP` as any,
            })
            .where(eq(resultados.id, existe.id));
        } else {
          await tx.insert(resultados).values({
            orden_analisis_id: item.orden_analisis_id,
            componente_id: item.componente_id,
            resultado: item.valor,
            observacion: item.observaciones || null,
            usuario_registro_id: usuarioId,
          });
        }
      }

      // Verificar si todos los componentes tienen resultado
      const analisisRows = await tx
        .select({
          orden_analisis_id: ordenAnalisis.id,
          componentes_ids: analisis.componentes_ids,
        })
        .from(ordenAnalisis)
        .innerJoin(analisis, eq(ordenAnalisis.analisis_id, analisis.id))
        .where(eq(ordenAnalisis.orden_id, ordenId));

      let todosCompletos = true;
      for (const an of analisisRows) {
        const cIds = an.componentes_ids || [];
        for (const cId of cIds) {
          const [rCheck] = await tx
            .select({ id: resultados.id })
            .from(resultados)
            .where(
              and(
                eq(resultados.orden_analisis_id, an.orden_analisis_id),
                eq(resultados.componente_id, cId)
              )
            );

          if (!rCheck) {
            todosCompletos = false;
            break;
          }
        }
        if (!todosCompletos) break;
      }

      let nuevoEstado = ordenCheck.estado;
      if (todosCompletos && ordenCheck.estado !== 'CON_RESULTADOS') {
        nuevoEstado = 'CON_RESULTADOS';
        await tx
          .update(ordenes)
          .set({
            estado: 'CON_RESULTADOS',
            updated_at: sql`CURRENT_TIMESTAMP` as any,
          })
          .where(eq(ordenes.id, ordenId));
      }

      return nuevoEstado;
    });

    if (ordenEstadoFinal === 'CON_RESULTADOS') {
      emitEvent('orden:estado_cambiado', { ordenId, estado: 'CON_RESULTADOS' });
      emitEvent('dashboard:update');

      this.generarInterpretacionIA(ordenId).catch((err) => {
        console.error('Error al generar interpretación IA en guardarResultados:', err);
      });
    }

    return {
      guardados: data.resultados.length,
      ordenEstado: ordenEstadoFinal,
    };
  }

  // ============================================
  // GENERAR INTERPRETACIÓN IA PRIVADO
  // ============================================

  private async generarInterpretacionIA(ordenId: number): Promise<void> {
    try {
      const [ordenRow] = await db
        .select({
          paciente_nombres: pacientes.nombres,
          paciente_apellidos: sql<string>`CONCAT(${pacientes.apellido_paterno}, ' ', ${pacientes.apellido_materno})`,
          fecha_nacimiento: pacientes.fecha_nacimiento,
          genero: pacientes.genero,
          interpretacion_ia: ordenes.interpretacion_ia,
        })
        .from(ordenes)
        .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
        .where(eq(ordenes.id, ordenId));

      if (!ordenRow || ordenRow.interpretacion_ia) {
        return;
      }

      // Calcular edad
      let edad = 0;
      if (ordenRow.fecha_nacimiento) {
        const fechaNac = new Date(ordenRow.fecha_nacimiento);
        const hoy = new Date();
        edad = hoy.getFullYear() - fechaNac.getFullYear();
        const m = hoy.getMonth() - fechaNac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
          edad--;
        }
      }

      // Obtener análisis con componentes y resultados
      const analisisRows = await db
        .select({
          orden_analisis_id: ordenAnalisis.id,
          analisis_id: ordenAnalisis.analisis_id,
          analisis_nombre: analisis.nombre,
          componentes_ids: analisis.componentes_ids,
        })
        .from(ordenAnalisis)
        .innerJoin(analisis, eq(ordenAnalisis.analisis_id, analisis.id))
        .where(eq(ordenAnalisis.orden_id, ordenId));

      const analisisParaIA: AnalisisParaIA[] = [];

      for (const an of analisisRows) {
        const cIds = an.componentes_ids || [];
        if (cIds.length === 0) continue;

        const compRows = await db
          .select({
            componente_id: componentes.id,
            componente_nombre: componentes.nombre,
            unidad_medida: componentes.unidad_medida,
            valores_referenciales: componentes.valores_referenciales,
            resultado_valor: resultados.resultado,
          })
          .from(componentes)
          .leftJoin(
            resultados,
            and(
              eq(resultados.componente_id, componentes.id),
              eq(resultados.orden_analisis_id, an.orden_analisis_id)
            )
          )
          .where(and(inArray(componentes.id, cIds), eq(componentes.activo, true)));

        const compList = compRows
          .filter((c) => c.resultado_valor !== null)
          .map((c) => ({
            componente_id: c.componente_id,
            componente_nombre: c.componente_nombre,
            unidad_medida: c.unidad_medida,
            valores_referenciales: c.valores_referenciales || [],
            resultado_valor: c.resultado_valor!,
          }));

        if (compList.length > 0) {
          analisisParaIA.push({
            analisis_id: an.analisis_id,
            analisis_nombre: an.analisis_nombre,
            componentes: compList,
          });
        }
      }

      if (analisisParaIA.length === 0) return;

      const ordenParaIA: OrdenParaIA = {
        orden_id: ordenId,
        paciente: {
          nombres: ordenRow.paciente_nombres,
          apellidos: ordenRow.paciente_apellidos,
          edad,
          genero: (ordenRow.genero as 'M' | 'F') || 'M',
        },
        analisis: analisisParaIA,
      };

      const interpretacion = await iaService.interpretarResultados(ordenParaIA);

      await db
        .update(ordenes)
        .set({
          interpretacion_ia: interpretacion,
          updated_at: sql`CURRENT_TIMESTAMP` as any,
        })
        .where(eq(ordenes.id, ordenId));
    } catch (error) {
      console.error(`Error al generar interpretación IA para orden ${ordenId}:`, error);
    }
  }
}

export const resultadosService = new ResultadosService();
