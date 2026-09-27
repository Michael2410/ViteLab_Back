// Tipos para el módulo de reportes

export interface FiltrosReporte {
  fecha_inicio?: string;
  fecha_fin?: string;
  sede_id?: number;
  sede_ids?: number[];
  estado?: string;
  usuario_id?: number;
}

// Reporte de Órdenes por Período
export interface OrdenReporte {
  id: number;
  numero_atencion: string;
  fecha_registro: string;
  paciente_dni: string;
  paciente_nombres: string;
  paciente_apellidos: string;
  sede_nombre: string;
  estado: string;
  tipo_paciente: string;
  convenio_nombre: string | null;
  total_analisis: number;
  monto_total: number;
}

export interface ReporteOrdenesPeriodo {
  ordenes: OrdenReporte[];
  totales: {
    cantidad: number;
    monto_total: number;
    por_estado: { estado: string; cantidad: number }[];
    por_tipo_paciente: { tipo: string; cantidad: number }[];
  };
}

// Reporte de Ingresos por Sede
export interface IngresoSede {
  sede_id: number;
  sede_nombre: string;
  cantidad_ordenes: number;
  monto_total: number;
  promedio_por_orden: number;
}

export interface ReporteIngresosSede {
  sedes: IngresoSede[];
  total_general: {
    cantidad_ordenes: number;
    monto_total: number;
  };
}

// Reporte de Análisis Más Solicitados
export interface AnalisisRanking {
  analisis_id: number;
  analisis_nombre: string;
  analisis_codigo: string;
  area_nombre: string;
  cantidad_solicitudes: number;
  porcentaje: number;
}

export interface ReporteAnalisisRanking {
  analisis: AnalisisRanking[];
  total_solicitudes: number;
}

// Reporte de Productividad por Usuario
export interface ProductividadUsuario {
  usuario_id: number;
  usuario_nombre: string;
  ordenes_registradas: number;
  resultados_ingresados: number;
  ordenes_aprobadas: number;
}

export interface ReporteProductividad {
  usuarios: ProductividadUsuario[];
  totales: {
    ordenes_registradas: number;
    resultados_ingresados: number;
    ordenes_aprobadas: number;
  };
}
