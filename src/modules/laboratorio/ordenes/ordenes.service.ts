import { eq, and, or, inArray, gte, lte, desc, asc, count, max, sql, aliasedTable } from 'drizzle-orm';
import {
  db,
  ordenes,
  pacientes,
  ordenAnalisis,
  tarifarios,
  tarifarioPrecios,
  convenios,
  sedes,
  tiposCliente,
  analisis,
  usuarios,
  personal,
  resultados,
} from '../../../db';
import { emitEvent } from '../../../config/socket';
import { iaService } from '../ia/ia.service';
import type {
  Paciente,
  CreatePacienteInput,
  Orden,
  CreateOrdenInput,
  UpdateOrdenInput,
  OrdenDetalle,
  OrdenFilters,
  EstadoOrden,
} from './ordenes.types';
import type { PaginatedResponse } from '../../../types/api.types';

export class OrdenesService {
  // ========== PACIENTES ==========

  async createPaciente(data: CreatePacienteInput): Promise<Paciente> {
    const nombreCompleto = `${data.apellido_paterno} ${data.apellido_materno}, ${data.nombres}`;
    const [row] = await db
      .insert(pacientes)
      .values({
        dni: data.dni,
        nombres: data.nombres,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno,
        nombre_completo: nombreCompleto,
        fecha_nacimiento: data.fecha_nacimiento as any,
        genero: data.genero,
        telefono: data.telefono || null,
        email: data.email || null,
        direccion: data.direccion || null,
      })
      .returning();

    return row as any;
  }

  async getPacienteByDni(dni: string): Promise<Paciente | null> {
    const [row] = await db
      .select()
      .from(pacientes)
      .where(eq(pacientes.dni, dni));

    return (row as any) || null;
  }

  // ========== ÓRDENES ==========

  async createOrden(data: CreateOrdenInput, usuarioId: number): Promise<OrdenDetalle> {
    const { ordenId, pacienteObj } = await db.transaction(async (tx) => {
      // 1. Crear u obtener paciente
      let [paciente] = await tx
        .select()
        .from(pacientes)
        .where(eq(pacientes.dni, data.paciente.dni));

      if (!paciente) {
        const nombreCompleto = `${data.paciente.apellido_paterno} ${data.paciente.apellido_materno}, ${data.paciente.nombres}`;
        const [newPac] = await tx
          .insert(pacientes)
          .values({
            dni: data.paciente.dni,
            nombres: data.paciente.nombres,
            apellido_paterno: data.paciente.apellido_paterno,
            apellido_materno: data.paciente.apellido_materno,
            nombre_completo: nombreCompleto,
            fecha_nacimiento: data.paciente.fecha_nacimiento as any,
            genero: data.paciente.genero,
            telefono: data.paciente.telefono || null,
            email: data.paciente.email || null,
            direccion: data.paciente.direccion || null,
          })
          .returning();

        paciente = newPac;
      }

      // 2. Generar número de atención único
      const numeroAtencion = await this.generateNumeroOrden(tx);

      // 3. Precios de análisis
      const analisisIds = data.analisis.map((a) => a.id);
      const precios = await this.calcularPrecios(tx, analisisIds, data.convenio_id);

      // 4. Crear orden
      const [orden] = await tx
        .insert(ordenes)
        .values({
          numero_atencion: numeroAtencion,
          paciente_id: paciente.id,
          sede_id: data.sede_id,
          tipo_cliente_id: data.tipo_cliente_id,
          convenio_id: data.convenio_id || null,
          estado: 'REGISTRADA',
          nota: data.nota || null,
          usuario_registro_id: usuarioId,
          muestra_recepcionada: false,
          medico: data.medico || null,
        })
        .returning();

      // 5. Crear orden_analisis
      for (const analisisItem of data.analisis) {
        const precioCalculado = precios.find((p) => p.analisis_id === analisisItem.id)?.precio || 0;
        const precioFinal =
          analisisItem.precio !== undefined && analisisItem.precio !== null
            ? analisisItem.precio
            : precioCalculado;

        await tx.insert(ordenAnalisis).values({
          orden_id: orden.id,
          analisis_id: analisisItem.id,
          precio: String(precioFinal),
          muestras_ids: analisisItem.muestras_ids || [],
        });
      }

      return { ordenId: orden.id, pacienteObj: paciente };
    });

    // Generar condiciones pre-analíticas en segundo plano
    this.generarCondicionesPreanaliticasIA(
      ordenId,
      {
        fecha_nacimiento: pacienteObj.fecha_nacimiento ?? undefined,
        genero: pacienteObj.genero ?? undefined,
      },
      data.analisis
    ).catch((err) => {
      console.error('Error al generar condiciones pre-analíticas IA:', err);
    });

    const ordenDetalle = await this.getOrdenById(ordenId);
    emitEvent('orden:creada', { orden: ordenDetalle });
    emitEvent('dashboard:update');

    return ordenDetalle;
  }

  async getOrdenById(id: number): Promise<OrdenDetalle> {
    const pur = aliasedTable(personal, 'pur');
    const purec = aliasedTable(personal, 'purec');
    const puapro = aliasedTable(personal, 'puapro');
    const urec = aliasedTable(usuarios, 'urec');
    const uapro = aliasedTable(usuarios, 'uapro');

    const [row]: any[] = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        paciente_id: ordenes.paciente_id,
        sede_id: ordenes.sede_id,
        tipo_cliente_id: ordenes.tipo_cliente_id,
        convenio_id: ordenes.convenio_id,
        usuario_registro_id: ordenes.usuario_registro_id,
        estado: ordenes.estado,
        nota: ordenes.nota,
        medico: ordenes.medico,
        tipo_paciente: ordenes.tipo_paciente,
        fecha_registro: ordenes.fecha_registro,
        fecha_recepcion: ordenes.fecha_recepcion,
        usuario_recepcion_id: ordenes.usuario_recepcion_id,
        fecha_aprobacion: ordenes.fecha_aprobacion,
        usuario_aprobacion_id: ordenes.usuario_aprobacion_id,
        muestra_recepcionada: ordenes.muestra_recepcionada,
        condiciones_preanaliticas: ordenes.condiciones_preanaliticas,
        created_at: ordenes.created_at,
        updated_at: ordenes.updated_at,
        paciente: {
          id: pacientes.id,
          dni: pacientes.dni,
          nombres: pacientes.nombres,
          apellido_paterno: pacientes.apellido_paterno,
          apellido_materno: pacientes.apellido_materno,
          nombre_completo: pacientes.nombre_completo,
          fecha_nacimiento: pacientes.fecha_nacimiento,
          genero: pacientes.genero,
          telefono: pacientes.telefono,
          email: pacientes.email,
          direccion: pacientes.direccion,
        },
        sede: {
          id: sedes.id,
          nombre: sedes.nombre,
          direccion: sedes.direccion,
        },
        tipo_cliente: {
          id: tiposCliente.id,
          nombre: tiposCliente.nombre,
        },
        convenio_id_val: convenios.id,
        convenio_nombre_empresa: convenios.nombre_empresa,
        convenio_tarifario_id: convenios.tarifario_id,
        usuario_registro: {
          id: usuarios.id,
          nombres: sql<string>`COALESCE(${pur.nombres}, ${usuarios.username})`,
          apellidos: sql<string>`COALESCE(${pur.apellidos}, '')`,
        },
        usuario_recepcion_id_val: urec.id,
        usuario_recepcion_nombres: sql<string | null>`COALESCE(${purec.nombres}, ${urec.username})`,
        usuario_recepcion_apellidos: sql<string | null>`COALESCE(${purec.apellidos}, '')`,
        usuario_aprobacion_id_val: uapro.id,
        usuario_aprobacion_nombres: sql<string | null>`COALESCE(${puapro.nombres}, ${uapro.username})`,
        usuario_aprobacion_apellidos: sql<string | null>`COALESCE(${puapro.apellidos}, '')`,
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .innerJoin(sedes, eq(ordenes.sede_id, sedes.id))
      .innerJoin(tiposCliente, eq(ordenes.tipo_cliente_id, tiposCliente.id))
      .leftJoin(convenios, eq(ordenes.convenio_id, convenios.id))
      .innerJoin(usuarios, eq(ordenes.usuario_registro_id, usuarios.id))
      .leftJoin(pur, eq(usuarios.personal_id, pur.id))
      .leftJoin(urec, eq(ordenes.usuario_recepcion_id, urec.id))
      .leftJoin(purec, eq(urec.personal_id, purec.id))
      .leftJoin(uapro, eq(ordenes.usuario_aprobacion_id, uapro.id))
      .leftJoin(puapro, eq(uapro.personal_id, puapro.id))
      .where(eq(ordenes.id, id));

    if (!row) {
      throw new Error('Orden no encontrada');
    }

    // Análisis de la orden
    const analisisRows = await db
      .select({
        id: ordenAnalisis.id,
        analisis_id: ordenAnalisis.analisis_id,
        nombre: analisis.nombre,
        precio: ordenAnalisis.precio,
        muestras_ids: ordenAnalisis.muestras_ids,
      })
      .from(ordenAnalisis)
      .innerJoin(analisis, eq(ordenAnalisis.analisis_id, analisis.id))
      .where(eq(ordenAnalisis.orden_id, id))
      .orderBy(asc(analisis.nombre));

    const convenio = row.convenio_id_val
      ? {
          id: row.convenio_id_val,
          nombre: row.convenio_nombre_empresa!,
          tarifario_id: row.convenio_tarifario_id ?? undefined,
        }
      : undefined;

    const usuario_recepcion = row.usuario_recepcion_id_val
      ? {
          id: row.usuario_recepcion_id_val,
          nombre: row.usuario_recepcion_nombres!,
          apellido: row.usuario_recepcion_apellidos!,
        }
      : undefined;

    const usuario_aprobacion = row.usuario_aprobacion_id_val
      ? {
          id: row.usuario_aprobacion_id_val,
          nombre: row.usuario_aprobacion_nombres!,
          apellido: row.usuario_aprobacion_apellidos!,
        }
      : undefined;

    return {
      id: row.id,
      numero_atencion: row.numero_atencion,
      paciente_id: row.paciente_id,
      sede_id: row.sede_id,
      tipo_cliente_id: row.tipo_cliente_id,
      convenio_id: row.convenio_id ?? undefined,
      estado: row.estado as EstadoOrden,
      muestra_recepcionada: row.muestra_recepcionada ?? false,
      medico: row.medico ?? undefined,
      fecha_registro: row.fecha_registro as any,
      fecha_aprobacion: row.fecha_aprobacion as any,
      nota: row.nota ?? undefined,
      condiciones_preanaliticas: row.condiciones_preanaliticas,
      usuario_registro_id: row.usuario_registro_id,
      usuario_aprobacion_id: row.usuario_aprobacion_id ?? undefined,
      created_at: row.created_at as any,
      updated_at: row.updated_at as any,
      paciente: {
        id: row.paciente.id,
        dni: row.paciente.dni,
        nombres: row.paciente.nombres,
        apellido_paterno: row.paciente.apellido_paterno,
        apellido_materno: row.paciente.apellido_materno,
        apellidos: `${row.paciente.apellido_paterno} ${row.paciente.apellido_materno}`.trim(),
        fecha_nacimiento: row.paciente.fecha_nacimiento ? new Date(row.paciente.fecha_nacimiento) : (null as any),
        genero: row.paciente.genero,
        sexo: row.paciente.genero,
        telefono: row.paciente.telefono ?? undefined,
        email: row.paciente.email ?? undefined,
        direccion: row.paciente.direccion ?? undefined,
      },
      sede: {
        id: row.sede.id,
        nombre: row.sede.nombre,
        direccion: row.sede.direccion ?? undefined,
      },
      tipo_cliente: {
        id: row.tipo_cliente.id,
        nombre: row.tipo_cliente.nombre,
      },
      convenio,
      analisis: analisisRows.map((a) => ({
        id: a.id,
        analisis_id: a.analisis_id,
        codigo: '',
        nombre: a.nombre,
        precio: Number(a.precio),
      })),
      usuario_registro: {
        id: row.usuario_registro.id,
        nombre: row.usuario_registro.nombres,
        apellido: row.usuario_registro.apellidos,
      },
      usuario_aprobacion,
    };
  }

  async updateOrden(id: number, data: UpdateOrdenInput): Promise<OrdenDetalle> {
    await db.transaction(async (tx) => {
      const [ordenActual] = await tx
        .select()
        .from(ordenes)
        .where(eq(ordenes.id, id));

      if (!ordenActual) {
        throw new Error('Orden no encontrada');
      }

      // Actualizar paciente si se proporcionó
      if (data.paciente) {
        const nombreCompleto = `${data.paciente.apellido_paterno} ${data.paciente.apellido_materno}, ${data.paciente.nombres}`;
        await tx
          .update(pacientes)
          .set({
            nombres: data.paciente.nombres,
            apellido_paterno: data.paciente.apellido_paterno,
            apellido_materno: data.paciente.apellido_materno,
            nombre_completo: nombreCompleto,
            fecha_nacimiento: data.paciente.fecha_nacimiento as any,
            genero: data.paciente.genero,
            telefono: data.paciente.telefono || null,
            email: data.paciente.email || null,
            direccion: data.paciente.direccion || null,
            updated_at: sql`CURRENT_TIMESTAMP` as any,
          })
          .where(eq(pacientes.id, ordenActual.paciente_id));
      }

      // Actualizar cabecera
      const updateData: Partial<typeof ordenes.$inferInsert> = {
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      };

      if (data.sede_id !== undefined) updateData.sede_id = data.sede_id;
      if (data.tipo_cliente_id !== undefined) updateData.tipo_cliente_id = data.tipo_cliente_id;
      if (data.convenio_id !== undefined) updateData.convenio_id = data.convenio_id || null;
      if (data.medico !== undefined) updateData.medico = data.medico || null;
      if (data.nota !== undefined) updateData.nota = data.nota || null;

      await tx
        .update(ordenes)
        .set(updateData)
        .where(eq(ordenes.id, id));

      // Sincronización diferencial de análisis
      if (data.analisis && Array.isArray(data.analisis)) {
        const analisisActuales = await tx
          .select({
            id: ordenAnalisis.id,
            analisis_id: ordenAnalisis.analisis_id,
            precio: ordenAnalisis.precio,
            muestras_ids: ordenAnalisis.muestras_ids,
          })
          .from(ordenAnalisis)
          .where(eq(ordenAnalisis.orden_id, id));

        const nuevosAnalisisIds = new Set(data.analisis.map((a) => a.id));

        // Eliminar análisis retirados y sus resultados
        const paraEliminar = analisisActuales.filter((oa) => !nuevosAnalisisIds.has(oa.analisis_id));
        for (const oa of paraEliminar) {
          await tx.delete(resultados).where(eq(resultados.orden_analisis_id, oa.id));
          await tx.delete(ordenAnalisis).where(eq(ordenAnalisis.id, oa.id));
        }

        // Calcular precios
        const convenioId =
          data.convenio_id !== undefined ? data.convenio_id : ordenActual.convenio_id ?? undefined;
        const analisisIds = data.analisis.map((a) => a.id);
        const preciosTarifario = await this.calcularPrecios(tx, analisisIds, convenioId);

        for (const item of data.analisis) {
          const precioCalculado = preciosTarifario.find((p) => p.analisis_id === item.id)?.precio || 0;
          const precioFinal =
            item.precio !== undefined && item.precio !== null ? item.precio : precioCalculado;

          const existente = analisisActuales.find((oa) => oa.analisis_id === item.id);
          if (existente) {
            await tx
              .update(ordenAnalisis)
              .set({
                precio: String(precioFinal),
                muestras_ids: item.muestras_ids || [],
              })
              .where(eq(ordenAnalisis.id, existente.id));
          } else {
            await tx.insert(ordenAnalisis).values({
              orden_id: id,
              analisis_id: item.id,
              precio: String(precioFinal),
              muestras_ids: item.muestras_ids || [],
            });
          }
        }
      }
    });

    const ordenDetalle = await this.getOrdenById(id);
    emitEvent('orden:actualizada', { orden: ordenDetalle });
    emitEvent('dashboard:update');

    return ordenDetalle;
  }

  async getOrdenes(filters: OrdenFilters): Promise<PaginatedResponse<Orden>> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters.estado) {
      conditions.push(eq(ordenes.estado, filters.estado));
    }
    if (filters.sede_id) {
      conditions.push(eq(ordenes.sede_id, filters.sede_id));
    }
    if (filters.sede_ids && filters.sede_ids.length > 0) {
      conditions.push(inArray(ordenes.sede_id, filters.sede_ids));
    }
    if (filters.fecha_desde) {
      conditions.push(gte(ordenes.fecha_registro, filters.fecha_desde as any));
    }
    if (filters.fecha_hasta) {
      conditions.push(lte(ordenes.fecha_registro, filters.fecha_hasta as any));
    }
    if (filters.paciente_dni) {
      conditions.push(sql`${pacientes.dni} LIKE ${`%${filters.paciente_dni}%`}`);
    }
    if (filters.paciente_nombre) {
      const s = `%${filters.paciente_nombre}%`;
      conditions.push(
        sql`(${pacientes.nombres} ILIKE ${s} OR ${pacientes.apellido_paterno} ILIKE ${s} OR ${pacientes.apellido_materno} ILIKE ${s})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count
    const [countResult] = await db
      .select({ count: count() })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const purec = aliasedTable(personal, 'purec');
    const urec = aliasedTable(usuarios, 'urec');

    const rows = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        paciente_id: ordenes.paciente_id,
        sede_id: ordenes.sede_id,
        tipo_cliente_id: ordenes.tipo_cliente_id,
        convenio_id: ordenes.convenio_id,
        estado: ordenes.estado,
        muestra_recepcionada: ordenes.muestra_recepcionada,
        condiciones_preanaliticas: ordenes.condiciones_preanaliticas,
        fecha_registro: ordenes.fecha_registro,
        fecha_recepcion: ordenes.fecha_recepcion,
        tipo_paciente: ordenes.tipo_paciente,
        nota: ordenes.nota,
        medico: ordenes.medico,
        usuario_registro_id: ordenes.usuario_registro_id,
        usuario_recepcion_id: ordenes.usuario_recepcion_id,
        created_at: ordenes.created_at,
        updated_at: ordenes.updated_at,
        paciente_dni: pacientes.dni,
        paciente_nombres: pacientes.nombres,
        paciente_apellidos: sql<string>`CONCAT(${pacientes.apellido_paterno}, ' ', ${pacientes.apellido_materno})`,
        paciente_telefono: pacientes.telefono,
        sede_nombre: sedes.nombre,
        tipo_cliente_nombre: tiposCliente.nombre,
        convenio_nombre: convenios.nombre_empresa,
        usuario_recepcion_nombres: sql<string | null>`COALESCE(${purec.nombres}, ${urec.username})`,
        usuario_recepcion_apellidos: sql<string | null>`COALESCE(${purec.apellidos}, '')`,
        total: sql<number>`COALESCE(SUM(${ordenAnalisis.precio}), 0)`,
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .innerJoin(sedes, eq(ordenes.sede_id, sedes.id))
      .innerJoin(tiposCliente, eq(ordenes.tipo_cliente_id, tiposCliente.id))
      .leftJoin(convenios, eq(ordenes.convenio_id, convenios.id))
      .leftJoin(ordenAnalisis, eq(ordenes.id, ordenAnalisis.orden_id))
      .leftJoin(urec, eq(ordenes.usuario_recepcion_id, urec.id))
      .leftJoin(purec, eq(urec.personal_id, purec.id))
      .where(whereClause)
      .groupBy(
        ordenes.id,
        ordenes.muestra_recepcionada,
        ordenes.condiciones_preanaliticas,
        ordenes.medico,
        ordenes.tipo_paciente,
        ordenes.fecha_recepcion,
        ordenes.usuario_recepcion_id,
        pacientes.dni,
        pacientes.nombres,
        pacientes.apellido_paterno,
        pacientes.apellido_materno,
        pacientes.telefono,
        sedes.nombre,
        tiposCliente.nombre,
        convenios.nombre_empresa,
        purec.nombres,
        purec.apellidos,
        urec.username
      )
      .orderBy(desc(ordenes.fecha_registro))
      .limit(limit)
      .offset(offset);

    const items: Orden[] = rows.map((row) => ({
      id: row.id,
      numero_atencion: row.numero_atencion,
      paciente_id: row.paciente_id,
      sede_id: row.sede_id,
      tipo_cliente_id: row.tipo_cliente_id,
      convenio_id: row.convenio_id ?? undefined,
      estado: row.estado as EstadoOrden,
      muestra_recepcionada: row.muestra_recepcionada || false,
      fecha_registro: row.fecha_registro as any,
      fecha_recepcion: row.fecha_recepcion as any,
      tipo_paciente: row.tipo_paciente as any,
      total: Number(row.total || 0),
      nota: row.nota ?? undefined,
      medico: row.medico ?? undefined,
      condiciones_preanaliticas: row.condiciones_preanaliticas,
      usuario_registro_id: row.usuario_registro_id,
      usuario_aprobacion_id: undefined,
      created_at: row.created_at as any,
      updated_at: row.updated_at as any,
      paciente_dni: row.paciente_dni,
      paciente_nombres: row.paciente_nombres,
      paciente_apellidos: row.paciente_apellidos,
      sede_nombre: row.sede_nombre,
      tipo_cliente_nombre: row.tipo_cliente_nombre,
      convenio_nombre: row.convenio_nombre ?? undefined,
    }));

    return {
      items,
      total,
      page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateEstadoOrden(
    id: number,
    estado: EstadoOrden,
    usuarioId: number
  ): Promise<Orden> {
    const updateData: Partial<typeof ordenes.$inferInsert> = {
      estado,
      updated_at: sql`CURRENT_TIMESTAMP` as any,
    };

    if (estado === 'MUESTRA_RECIBIDA') {
      updateData.muestra_recepcionada = true;
      updateData.fecha_recepcion = sql`CURRENT_TIMESTAMP` as any;
      updateData.usuario_recepcion_id = usuarioId;
    } else if (estado === 'APROBADA') {
      updateData.fecha_aprobacion = sql`CURRENT_TIMESTAMP` as any;
      updateData.usuario_aprobacion_id = usuarioId;
    }

    const [ordenActualizada] = await db
      .update(ordenes)
      .set(updateData)
      .where(eq(ordenes.id, id))
      .returning();

    emitEvent('orden:estado_cambiado', { orden: ordenActualizada });
    emitEvent('dashboard:update');

    return ordenActualizada as any;
  }

  async deleteOrden(id: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(ordenAnalisis).where(eq(ordenAnalisis.orden_id, id));
      const rows = await tx
        .delete(ordenes)
        .where(eq(ordenes.id, id))
        .returning({ id: ordenes.id });

      if (rows.length > 0) {
        emitEvent('orden:eliminada', { ordenId: id });
        emitEvent('dashboard:update');
      }

      return rows.length > 0;
    });
  }

  async recepcionarMuestra(id: number, usuarioId: number): Promise<Orden> {
    const [ordenActualizada] = await db
      .update(ordenes)
      .set({
        muestra_recepcionada: true,
        estado: 'MUESTRA_RECIBIDA',
        usuario_recepcion_id: usuarioId,
        fecha_recepcion: sql`CURRENT_TIMESTAMP` as any,
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      })
      .where(and(eq(ordenes.id, id), eq(ordenes.estado, 'REGISTRADA')))
      .returning();

    if (!ordenActualizada) {
      throw new Error('Orden no encontrada o no está en estado REGISTRADA');
    }

    emitEvent('orden:estado_cambiado', { orden: ordenActualizada });
    emitEvent('dashboard:update');

    return ordenActualizada as any;
  }

  // ========== HELPERS ==========

  private async generateNumeroOrden(txOrDb: any = db): Promise<number> {
    const [result] = await txOrDb
      .select({
        siguiente: sql<number>`COALESCE(MAX(${ordenes.numero_atencion}), 0) + 1`,
      })
      .from(ordenes);

    return Number(result?.siguiente || 1);
  }

  async obtenerPreciosAnalisis(
    analisisIds: number[],
    convenioId?: number
  ): Promise<Array<{ analisis_id: number; nombre: string; precio: number }>> {
    let tarifarioId: number;

    if (convenioId) {
      const [conv] = await db
        .select({ tarifario_id: convenios.tarifario_id })
        .from(convenios)
        .where(eq(convenios.id, convenioId));

      if (!conv || !conv.tarifario_id) {
        throw new Error('Convenio no tiene tarifario asignado');
      }
      tarifarioId = conv.tarifario_id;
    } else {
      const [tarifarioGen] = await db
        .select({ id: tarifarios.id })
        .from(tarifarios)
        .where(and(eq(tarifarios.nombre, 'Tarifario General'), eq(tarifarios.activo, true)))
        .limit(1);

      if (!tarifarioGen) {
        throw new Error('No se encontró el Tarifario General para clientes particulares');
      }
      tarifarioId = tarifarioGen.id;
    }

    const rows = await db
      .select({
        analisis_id: analisis.id,
        nombre: analisis.nombre,
        precio: sql<string>`COALESCE(${tarifarioPrecios.precio}, 0)`,
      })
      .from(analisis)
      .leftJoin(
        tarifarioPrecios,
        and(
          eq(tarifarioPrecios.analisis_id, analisis.id),
          eq(tarifarioPrecios.tarifario_id, tarifarioId)
        )
      )
      .where(inArray(analisis.id, analisisIds));

    return rows.map((r) => ({
      analisis_id: r.analisis_id,
      nombre: r.nombre,
      precio: parseFloat(r.precio),
    }));
  }

  private async calcularPrecios(
    txOrDb: any,
    analisisIds: number[],
    convenioId?: number
  ): Promise<Array<{ analisis_id: number; precio: number }>> {
    let tarifarioId: number;

    if (convenioId) {
      const [conv] = await txOrDb
        .select({ tarifario_id: convenios.tarifario_id })
        .from(convenios)
        .where(eq(convenios.id, convenioId));

      if (!conv || !conv.tarifario_id) {
        throw new Error('Convenio no tiene tarifario asignado');
      }
      tarifarioId = conv.tarifario_id;
    } else {
      const [tarifarioGen] = await txOrDb
        .select({ id: tarifarios.id })
        .from(tarifarios)
        .where(and(eq(tarifarios.nombre, 'Tarifario General'), eq(tarifarios.activo, true)))
        .limit(1);

      if (!tarifarioGen) {
        throw new Error('No se encontró el Tarifario General para clientes particulares');
      }
      tarifarioId = tarifarioGen.id;
    }

    const precios: Array<{ analisis_id: number; precio: number }> = [];

    for (const analisisId of analisisIds) {
      const [precioRow] = await txOrDb
        .select({ precio: tarifarioPrecios.precio })
        .from(tarifarioPrecios)
        .where(
          and(
            eq(tarifarioPrecios.tarifario_id, tarifarioId),
            eq(tarifarioPrecios.analisis_id, analisisId)
          )
        );

      if (!precioRow) {
        precios.push({ analisis_id: analisisId, precio: 0 });
      } else {
        precios.push({ analisis_id: analisisId, precio: parseFloat(precioRow.precio) });
      }
    }

    return precios;
  }

  async getMedicos(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ medico: ordenes.medico })
      .from(ordenes)
      .where(and(sql`${ordenes.medico} IS NOT NULL`, sql`${ordenes.medico} != ''`))
      .orderBy(asc(ordenes.medico));

    return rows.map((r) => r.medico!).filter(Boolean);
  }

  // ========== ALERTAS ==========

  async getAlertasCounts(): Promise<{
    ordenesAprobadas: number;
    ordenesPendientesAprobar: number;
    ordenesAprobadasDetalle: Array<{
      id: number;
      numero_atencion: number;
      paciente_nombre: string;
      fecha_aprobacion: Date;
    }>;
  }> {
    const [aprobadas] = await db
      .select({ count: count() })
      .from(ordenes)
      .where(eq(ordenes.estado, 'APROBADA'));

    const [pendientesAprobar] = await db
      .select({ count: count() })
      .from(ordenes)
      .where(eq(ordenes.estado, 'CON_RESULTADOS'));

    const detalleAprobadas = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        paciente_nombre: sql<string>`CONCAT(${pacientes.nombres}, ' ', ${pacientes.apellido_paterno}, ' ', ${pacientes.apellido_materno})`,
        fecha_aprobacion: ordenes.fecha_aprobacion,
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .where(eq(ordenes.estado, 'APROBADA'))
      .orderBy(desc(ordenes.fecha_aprobacion))
      .limit(20);

    return {
      ordenesAprobadas: Number(aprobadas?.count || 0),
      ordenesPendientesAprobar: Number(pendientesAprobar?.count || 0),
      ordenesAprobadasDetalle: detalleAprobadas as any,
    };
  }

  async marcarComoImpreso(ordenId: number): Promise<Orden | null> {
    const [orden] = await db
      .update(ordenes)
      .set({
        estado: 'IMPRESO',
        updated_at: sql`CURRENT_TIMESTAMP` as any,
      })
      .where(and(eq(ordenes.id, ordenId), eq(ordenes.estado, 'APROBADA')))
      .returning();

    if (orden) {
      emitEvent('orden:estado_cambiado', { orden });
      emitEvent('dashboard:update');
    }

    return (orden as any) || null;
  }

  private async generarCondicionesPreanaliticasIA(
    ordenId: number,
    pacienteInput: { fecha_nacimiento?: string | Date; genero?: string },
    analisisInput: { id: number }[]
  ): Promise<string> {
    try {
      const analisisIds = analisisInput.map((a) => a.id);
      if (analisisIds.length === 0) return '';

      const resAnalisis = await db
        .select({ nombre: analisis.nombre })
        .from(analisis)
        .where(inArray(analisis.id, analisisIds));

      const analisisNombres = resAnalisis.map((r) => r.nombre);

      let edadPaciente = 0;
      if (pacienteInput.fecha_nacimiento) {
        const fechaNac = new Date(pacienteInput.fecha_nacimiento);
        const hoy = new Date();
        edadPaciente = hoy.getFullYear() - fechaNac.getFullYear();
        const m = hoy.getMonth() - fechaNac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
          edadPaciente--;
        }
      }

      return await iaService.procesarCondicionesPreanaliticas(ordenId, {
        paciente_genero: pacienteInput.genero || 'M',
        paciente_edad: edadPaciente > 0 ? edadPaciente : 30,
        analisis_nombres: analisisNombres,
      });
    } catch (error) {
      console.error(`Error en generarCondicionesPreanaliticasIA para orden ${ordenId}:`, error);
      return '';
    }
  }

  async obtenerOCrearPreanalitica(ordenId: number): Promise<string> {
    const [row] = await db
      .select({
        condiciones_preanaliticas: ordenes.condiciones_preanaliticas,
        fecha_nacimiento: pacientes.fecha_nacimiento,
        genero: pacientes.genero,
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .where(eq(ordenes.id, ordenId));

    if (!row) {
      throw new Error('La orden no existe');
    }

    if (row.condiciones_preanaliticas) {
      return row.condiciones_preanaliticas;
    }

    const analisisRes = await db
      .select({ analisis_id: ordenAnalisis.analisis_id })
      .from(ordenAnalisis)
      .where(eq(ordenAnalisis.orden_id, ordenId));

    const analisisInput = analisisRes.map((r) => ({ id: r.analisis_id }));

    return await this.generarCondicionesPreanaliticasIA(ordenId, row as any, analisisInput);
  }
}

export const ordenesService = new OrdenesService();
