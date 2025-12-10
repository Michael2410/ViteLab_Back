// ============================================
// INTERFACES
// ============================================

export interface Resultado {
  id: number;
  orden_analisis_id: number;
  componente_id: number;
  valor: string;
  unidad_medida?: string | null;
  valor_referencia?: string | null;
  observaciones?: string | null;
  usuario_registro_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface ResultadoDetalle extends Resultado {
  componente_nombre: string;
  orden_id: number;
  numero_atencion: number;
  analisis_nombre: string;
  usuario_registro_nombre?: string;
}

export interface OrdenConResultados {
  id: number;
  numero_atencion: number;
  estado: string;
  paciente_nombres: string;
  paciente_apellidos: string;
  paciente_dni: string;
  paciente_genero?: string;
  paciente_fecha_nacimiento?: Date;
  fecha_registro: Date;
  fecha_aprobacion?: Date;
  sede_nombre?: string;
  tipo_cliente_nombre?: string;
  convenio_nombre?: string;
  convenio_direccion?: string;
  convenio_logo_url?: string;
  medico?: string;
  aprobado_por_nombres?: string;
  aprobado_por_apellidos?: string;
  aprobado_por_firma_url?: string;
  interpretacion_ia?: string | null;
  analisis: AnalisisConComponentes[];
}

export interface AnalisisConComponentes {
  orden_analisis_id: number;
  analisis_id: number;
  analisis_nombre: string;
  componentes: ComponenteConResultado[];
}

export interface ComponenteConResultado {
  componente_id: number;
  componente_nombre: string;
  unidad_medida?: string | null;
  valores_referenciales?: string[];
  valor_alerta_min?: number | null;
  valor_alerta_max?: number | null;
  metodo_nombre?: string | null;
  resultado_id?: number | null;
  resultado_valor?: string | null;
  resultado_observaciones?: string | null;
  tiene_resultado: boolean;
}

// ============================================
// INPUTS
// ============================================

export interface CreateResultadoInput {
  orden_analisis_id: number;
  componente_id: number;
  valor: string;
  unidad_medida?: string;
  observaciones?: string;
}

export interface UpdateResultadoInput {
  valor?: string;
  unidad_medida?: string;
  observaciones?: string;
}

export interface BulkResultadosInput {
  orden_id: number;
  resultados: {
    orden_analisis_id: number;
    componente_id: number;
    valor: string;
    unidad_medida?: string;
    observaciones?: string;
  }[];
}

// ============================================
// FILTERS
// ============================================

export interface ResultadosFilters {
  orden_id?: number;
  orden_analisis_id?: number;
  componente_id?: number;
}
