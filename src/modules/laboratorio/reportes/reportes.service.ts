import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import {
  db,
  ordenes,
  pacientes,
  sedes,
  convenios,
  ordenAnalisis,
  analisis,
  usuarios,
  personal,
  resultados,
} from '../../../db';
import type {
  FiltrosReporte,
  ReporteOrdenesPeriodo,
  ReporteIngresosSede,
  ReporteAnalisisRanking,
  ReporteProductividad,
  OrdenReporte,
  FiltrosCuadreCaja,
  ReporteCuadreCaja,
  PagoCuadreDetalle,
  MetodoPagoTotales,
} from './reportes.types';

class ReportesService {
  /**
   * Reporte de Órdenes por Período
   */
  async getOrdenesPorPeriodo(filtros: FiltrosReporte): Promise<ReporteOrdenesPeriodo> {
    const conditions = [];

    if (filtros.fecha_inicio) {
      conditions.push(sql`DATE(${ordenes.fecha_registro}) >= ${filtros.fecha_inicio}`);
    }

    if (filtros.fecha_fin) {
      conditions.push(sql`DATE(${ordenes.fecha_registro}) <= ${filtros.fecha_fin}`);
    }

    if (filtros.sede_id) {
      conditions.push(eq(ordenes.sede_id, filtros.sede_id));
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      conditions.push(inArray(ordenes.sede_id, filtros.sede_ids));
    }

    if (filtros.estado) {
      conditions.push(eq(ordenes.estado, filtros.estado));
    }

    if (filtros.metodo_pago) {
      conditions.push(eq(ordenes.metodo_pago, filtros.metodo_pago));
    }

    const usuarioFiltro = filtros.usuario_registro_id || filtros.usuario_id;
    if (usuarioFiltro) {
      conditions.push(eq(ordenes.usuario_registro_id, usuarioFiltro));
    }

    const rows = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        fecha_registro: sql<string>`${ordenes.fecha_registro}::text`,
        estado: ordenes.estado,
        tipo_paciente: ordenes.tipo_paciente,
        metodo_pago: sql<string>`COALESCE(${ordenes.metodo_pago}, 'EFECTIVO')`,
        paciente_dni: sql<string>`COALESCE(${pacientes.dni}, '')`,
        paciente_nombres: sql<string>`COALESCE(${pacientes.nombres}, '')`,
        paciente_apellidos: sql<string>`CONCAT(COALESCE(${pacientes.apellido_paterno}, ''), ' ', COALESCE(${pacientes.apellido_materno}, ''))`,
        sede_nombre: sedes.nombre,
        convenio_nombre: convenios.nombre_empresa,
        usuario_nombre: sql<string>`CONCAT(COALESCE(${personal.nombres}, ${usuarios.username}), ' ', COALESCE(${personal.apellidos}, ''))`,
        total_analisis: sql<number>`(SELECT COUNT(*) FROM orden_analisis WHERE orden_id = ${ordenes.id})::int`,
        monto_total: sql<number>`COALESCE((SELECT SUM(oa.precio) FROM orden_analisis oa WHERE oa.orden_id = ${ordenes.id}), 0)::float`,
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .innerJoin(sedes, eq(ordenes.sede_id, sedes.id))
      .leftJoin(convenios, eq(ordenes.convenio_id, convenios.id))
      .leftJoin(usuarios, eq(ordenes.usuario_registro_id, usuarios.id))
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ordenes.fecha_registro));

    const ordenesReporte: OrdenReporte[] = rows.map((r) => ({
      id: r.id,
      numero_atencion: String(r.numero_atencion || ''),
      fecha_registro: r.fecha_registro,
      estado: r.estado,
      tipo_paciente: r.tipo_paciente || 'PARTICULAR',
      metodo_pago: r.metodo_pago || 'EFECTIVO',
      paciente_dni: r.paciente_dni,
      paciente_nombres: r.paciente_nombres,
      paciente_apellidos: r.paciente_apellidos.trim(),
      sede_nombre: r.sede_nombre,
      convenio_nombre: r.convenio_nombre,
      usuario_nombre: r.usuario_nombre?.trim() || undefined,
      total_analisis: Number(r.total_analisis) || 0,
      monto_total: Number(r.monto_total) || 0,
    }));

    // Calcular totales
    const totales = {
      cantidad: ordenesReporte.length,
      monto_total: ordenesReporte.reduce((acc, o) => acc + o.monto_total, 0),
      por_estado: this.agruparPor(ordenesReporte, 'estado'),
      por_tipo_paciente: this.agruparPorTipo(ordenesReporte, 'tipo_paciente'),
      por_metodo_pago: this.agruparPorMetodoPago(ordenesReporte),
    };

    return { ordenes: ordenesReporte, totales };
  }

  /**
   * Reporte de Cuadre de Caja Diaria (Arqueo por Turno / Colaborador)
   */
  async getCuadreCaja(filtros: FiltrosCuadreCaja): Promise<ReporteCuadreCaja> {
    const conditions = [];
    const fechaConsulta = filtros.fecha || new Date().toISOString().split('T')[0];

    conditions.push(sql`DATE(${ordenes.fecha_registro}) = ${fechaConsulta}`);

    if (filtros.sede_id) {
      conditions.push(eq(ordenes.sede_id, filtros.sede_id));
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      conditions.push(inArray(ordenes.sede_id, filtros.sede_ids));
    }

    if (filtros.usuario_id) {
      conditions.push(eq(ordenes.usuario_registro_id, filtros.usuario_id));
    }

    const rows = await db
      .select({
        id: ordenes.id,
        numero_atencion: ordenes.numero_atencion,
        fecha_registro: sql<string>`${ordenes.fecha_registro}::text`,
        metodo_pago: sql<string>`COALESCE(${ordenes.metodo_pago}, 'EFECTIVO')`,
        paciente_nombres: sql<string>`COALESCE(${pacientes.nombres}, '')`,
        paciente_apellidos: sql<string>`CONCAT(COALESCE(${pacientes.apellido_paterno}, ''), ' ', COALESCE(${pacientes.apellido_materno}, ''))`,
        paciente_dni: sql<string>`COALESCE(${pacientes.dni}, '')`,
        sede_nombre: sedes.nombre,
        usuario_registro_nombre: sql<string>`CONCAT(COALESCE(${personal.nombres}, ${usuarios.username}), ' ', COALESCE(${personal.apellidos}, ''))`,
        total_analisis: sql<number>`(SELECT COUNT(*) FROM orden_analisis WHERE orden_id = ${ordenes.id})::int`,
        monto: sql<number>`COALESCE((SELECT SUM(oa.precio) FROM orden_analisis oa WHERE oa.orden_id = ${ordenes.id}), 0)::float`,
      })
      .from(ordenes)
      .innerJoin(pacientes, eq(ordenes.paciente_id, pacientes.id))
      .innerJoin(sedes, eq(ordenes.sede_id, sedes.id))
      .innerJoin(usuarios, eq(ordenes.usuario_registro_id, usuarios.id))
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .where(and(...conditions))
      .orderBy(desc(ordenes.fecha_registro));

    const ordenesCuadre: PagoCuadreDetalle[] = rows.map((r) => ({
      id: r.id,
      numero_atencion: String(r.numero_atencion || ''),
      fecha_hora: r.fecha_registro,
      paciente_nombre: `${r.paciente_apellidos.trim()}, ${r.paciente_nombres}`.trim(),
      paciente_dni: r.paciente_dni,
      sede_nombre: r.sede_nombre,
      usuario_registro_nombre: r.usuario_registro_nombre.trim(),
      metodo_pago: r.metodo_pago,
      total_analisis: Number(r.total_analisis) || 0,
      monto: Number(r.monto) || 0,
    }));

    // Métodos estándar
    const metodosBase = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'];
    const mapaMetodos: Record<string, { cantidad: number; monto: number }> = {};
    for (const m of metodosBase) {
      mapaMetodos[m] = { cantidad: 0, monto: 0 };
    }

    let totalEfectivo = 0;
    let totalDigital = 0;
    let totalRecaudado = 0;

    for (const o of ordenesCuadre) {
      const m = o.metodo_pago.toUpperCase();
      if (!mapaMetodos[m]) {
        mapaMetodos[m] = { cantidad: 0, monto: 0 };
      }
      mapaMetodos[m].cantidad += 1;
      mapaMetodos[m].monto += o.monto;
      totalRecaudado += o.monto;

      if (m === 'EFECTIVO') {
        totalEfectivo += o.monto;
      } else {
        totalDigital += o.monto;
      }
    }

    const desglose_metodos: MetodoPagoTotales[] = Object.entries(mapaMetodos).map(([metodo, data]) => ({
      metodo,
      cantidad: data.cantidad,
      monto: data.monto,
    }));

    const cantidad_ordenes = ordenesCuadre.length;

    return {
      fecha: fechaConsulta,
      sede_id: filtros.sede_id,
      usuario_id: filtros.usuario_id,
      totales: {
        total_efectivo: totalEfectivo,
        total_digital: totalDigital,
        total_recaudado: totalRecaudado,
        cantidad_ordenes,
        ticket_promedio: cantidad_ordenes > 0 ? totalRecaudado / cantidad_ordenes : 0,
      },
      desglose_metodos,
      ordenes: ordenesCuadre,
    };
  }

  /**
   * Reporte de Ingresos por Sede
   */
  async getIngresosPorSede(filtros: FiltrosReporte): Promise<ReporteIngresosSede> {
    const conditions = [eq(sedes.activo, true)];

    if (filtros.fecha_inicio) {
      conditions.push(sql`(${ordenes.fecha_registro} IS NULL OR DATE(${ordenes.fecha_registro}) >= ${filtros.fecha_inicio})`);
    }

    if (filtros.fecha_fin) {
      conditions.push(sql`(${ordenes.fecha_registro} IS NULL OR DATE(${ordenes.fecha_registro}) <= ${filtros.fecha_fin})`);
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      conditions.push(inArray(sedes.id, filtros.sede_ids));
    }

    const rows = await db
      .select({
        sede_id: sedes.id,
        sede_nombre: sedes.nombre,
        cantidad_ordenes: sql<number>`COUNT(${ordenes.id})::int`,
        monto_total: sql<number>`COALESCE(SUM((SELECT SUM(oa.precio) FROM orden_analisis oa WHERE oa.orden_id = ${ordenes.id})), 0)::float`,
      })
      .from(sedes)
      .leftJoin(ordenes, eq(sedes.id, ordenes.sede_id))
      .where(and(...conditions))
      .groupBy(sedes.id, sedes.nombre)
      .orderBy(desc(sql`COALESCE(SUM((SELECT SUM(oa.precio) FROM orden_analisis oa WHERE oa.orden_id = ${ordenes.id})), 0)`));

    const sedesRes = rows.map((row) => {
      const cantidad = Number(row.cantidad_ordenes) || 0;
      const monto = Number(row.monto_total) || 0;
      return {
        sede_id: row.sede_id,
        sede_nombre: row.sede_nombre,
        cantidad_ordenes: cantidad,
        monto_total: monto,
        promedio_por_orden: cantidad > 0 ? monto / cantidad : 0,
      };
    });

    const total_general = {
      cantidad_ordenes: sedesRes.reduce((acc, s) => acc + s.cantidad_ordenes, 0),
      monto_total: sedesRes.reduce((acc, s) => acc + s.monto_total, 0),
    };

    return { sedes: sedesRes, total_general };
  }

  /**
   * Reporte de Análisis Más Solicitados
   */
  async getAnalisisRanking(filtros: FiltrosReporte): Promise<ReporteAnalisisRanking> {
    const conditions = [eq(analisis.activo, true)];

    if (filtros.fecha_inicio) {
      conditions.push(sql`(${ordenes.fecha_registro} IS NULL OR DATE(${ordenes.fecha_registro}) >= ${filtros.fecha_inicio})`);
    }

    if (filtros.fecha_fin) {
      conditions.push(sql`(${ordenes.fecha_registro} IS NULL OR DATE(${ordenes.fecha_registro}) <= ${filtros.fecha_fin})`);
    }

    if (filtros.sede_ids && filtros.sede_ids.length > 0) {
      conditions.push(sql`(${ordenes.sede_id} IS NULL OR ${inArray(ordenes.sede_id, filtros.sede_ids)})`);
    }

    const rows = await db
      .select({
        analisis_id: analisis.id,
        analisis_nombre: analisis.nombre,
        area_nombre: sql<string>`COALESCE((SELECT ar.nombre FROM componentes c INNER JOIN areas ar ON c.area_id = ar.id WHERE c.analisis_id = ${analisis.id} LIMIT 1), 'Sin área')`,
        cantidad_solicitudes: sql<number>`COUNT(${ordenAnalisis.id})::int`,
      })
      .from(analisis)
      .leftJoin(ordenAnalisis, eq(analisis.id, ordenAnalisis.analisis_id))
      .leftJoin(ordenes, eq(ordenAnalisis.orden_id, ordenes.id))
      .where(and(...conditions))
      .groupBy(analisis.id, analisis.nombre)
      .orderBy(desc(sql`COUNT(${ordenAnalisis.id})`))
      .limit(20);

    const total_solicitudes = rows.reduce(
      (acc, row) => acc + (Number(row.cantidad_solicitudes) || 0),
      0
    );

    const analisisRes = rows.map((row) => {
      const cantidad = Number(row.cantidad_solicitudes) || 0;
      return {
        analisis_id: row.analisis_id,
        analisis_nombre: row.analisis_nombre,
        analisis_codigo: '',
        area_nombre: row.area_nombre,
        cantidad_solicitudes: cantidad,
        porcentaje: total_solicitudes > 0 ? (cantidad / total_solicitudes) * 100 : 0,
      };
    });

    return { analisis: analisisRes, total_solicitudes };
  }

  /**
   * Reporte de Productividad por Usuario
   */
  async getProductividadUsuarios(filtros: FiltrosReporte): Promise<ReporteProductividad> {
    const usersResult = await db
      .select({
        id: usuarios.id,
        nombre: sql<string>`CONCAT(COALESCE(${personal.nombres}, ${usuarios.username}), ' ', COALESCE(${personal.apellidos}, ''))`,
      })
      .from(usuarios)
      .leftJoin(personal, eq(usuarios.personal_id, personal.id))
      .where(eq(usuarios.activo, true));

    const usuariosCalculados = await Promise.all(
      usersResult.map(async (user) => {
        // Órdenes registradas
        const condsOrdenes = [eq(ordenes.usuario_registro_id, user.id)];
        if (filtros.fecha_inicio) condsOrdenes.push(sql`DATE(${ordenes.fecha_registro}) >= ${filtros.fecha_inicio}`);
        if (filtros.fecha_fin) condsOrdenes.push(sql`DATE(${ordenes.fecha_registro}) <= ${filtros.fecha_fin}`);
        if (filtros.sede_ids && filtros.sede_ids.length > 0) condsOrdenes.push(inArray(ordenes.sede_id, filtros.sede_ids));

        const [ordenesResult] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(ordenes)
          .where(and(...condsOrdenes));

        // Resultados ingresados
        const condsResultados = [eq(resultados.usuario_registro_id, user.id)];
        if (filtros.fecha_inicio) condsResultados.push(sql`DATE(${ordenes.fecha_registro}) >= ${filtros.fecha_inicio}`);
        if (filtros.fecha_fin) condsResultados.push(sql`DATE(${ordenes.fecha_registro}) <= ${filtros.fecha_fin}`);
        if (filtros.sede_ids && filtros.sede_ids.length > 0) condsResultados.push(inArray(ordenes.sede_id, filtros.sede_ids));

        const [resultadosResult] = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${resultados.id})::int` })
          .from(resultados)
          .innerJoin(ordenAnalisis, eq(resultados.orden_analisis_id, ordenAnalisis.id))
          .innerJoin(ordenes, eq(ordenAnalisis.orden_id, ordenes.id))
          .where(and(...condsResultados));

        // Órdenes aprobadas
        const condsAprobadas = [eq(ordenes.usuario_aprobacion_id, user.id)];
        if (filtros.fecha_inicio) condsAprobadas.push(sql`DATE(${ordenes.fecha_registro}) >= ${filtros.fecha_inicio}`);
        if (filtros.fecha_fin) condsAprobadas.push(sql`DATE(${ordenes.fecha_registro}) <= ${filtros.fecha_fin}`);
        if (filtros.sede_ids && filtros.sede_ids.length > 0) condsAprobadas.push(inArray(ordenes.sede_id, filtros.sede_ids));

        const [aprobadasResult] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(ordenes)
          .where(and(...condsAprobadas));

        return {
          usuario_id: user.id,
          usuario_nombre: user.nombre.trim(),
          ordenes_registradas: Number(ordenesResult?.count) || 0,
          resultados_ingresados: Number(resultadosResult?.count) || 0,
          ordenes_aprobadas: Number(aprobadasResult?.count) || 0,
        };
      })
    );

    // Filtrar usuarios sin actividad
    const usuariosActivos = usuariosCalculados.filter(
      (u) => u.ordenes_registradas > 0 || u.resultados_ingresados > 0 || u.ordenes_aprobadas > 0
    );

    const totales = {
      ordenes_registradas: usuariosActivos.reduce((acc, u) => acc + u.ordenes_registradas, 0),
      resultados_ingresados: usuariosActivos.reduce((acc, u) => acc + u.resultados_ingresados, 0),
      ordenes_aprobadas: usuariosActivos.reduce((acc, u) => acc + u.ordenes_aprobadas, 0),
    };

    return { usuarios: usuariosActivos, totales };
  }

  // Helpers
  private agruparPor(items: any[], campo: string): { estado: string; cantidad: number }[] {
    const grupos: Record<string, number> = {};
    items.forEach((item) => {
      const valor = item[campo] || 'Sin definir';
      grupos[valor] = (grupos[valor] || 0) + 1;
    });
    return Object.entries(grupos).map(([estado, cantidad]) => ({ estado, cantidad }));
  }

  private agruparPorTipo(items: any[], campo: string): { tipo: string; cantidad: number }[] {
    const grupos: Record<string, number> = {};
    items.forEach((item) => {
      const valor = item[campo] || 'PARTICULAR';
      grupos[valor] = (grupos[valor] || 0) + 1;
    });
    return Object.entries(grupos).map(([tipo, cantidad]) => ({ tipo, cantidad }));
  }

  private agruparPorMetodoPago(items: OrdenReporte[]): MetodoPagoTotales[] {
    const grupos: Record<string, { cantidad: number; monto: number }> = {};
    items.forEach((item) => {
      const metodo = (item.metodo_pago || 'EFECTIVO').toUpperCase();
      if (!grupos[metodo]) {
        grupos[metodo] = { cantidad: 0, monto: 0 };
      }
      grupos[metodo].cantidad += 1;
      grupos[metodo].monto += Number(item.monto_total) || 0;
    });
    return Object.entries(grupos).map(([metodo, val]) => ({
      metodo,
      cantidad: val.cantidad,
      monto: val.monto,
    }));
  }
}

export const reportesService = new ReportesService();
