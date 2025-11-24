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
  componente_codigo: string;
  orden_id: number;
  numero_orden: string;
  analisis_nombre: string;
  usuario_registro_nombre?: string;
}

export interface OrdenConResultados {
  id: number;
  numero_orden: string;
  paciente_nombres: string;
  paciente_apellidos: string;
  paciente_dni: string;
  fecha_registro: Date;
  analisis: AnalisisConComponentes[];
}

export interface AnalisisConComponentes {
  orden_analisis_id: number;
  analisis_id: number;
  analisis_nombre: string;
  analisis_codigo: string;
  componentes: ComponenteConResultado[];
}

export interface ComponenteConResultado {
  componente_id: number;
  componente_codigo: string;
  componente_nombre: string;
  unidad_medida?: string | null;
  valor_referencia_min?: number | null;
  valor_referencia_max?: number | null;
  valor_referencia_texto?: string | null;
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
