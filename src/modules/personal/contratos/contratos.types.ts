export type EstadoContrato = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'RENOVADO' | 'CANCELADO';

export interface ContratoItem {
  id: number;
  personal_id: number;
  colaborador_nombre?: string;
  colaborador_documento?: string;
  colaborador_activo?: boolean;
  tipo_contrato_id?: number | null;
  tipo_contrato_nombre?: string | null;
  numero_contrato?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  es_indefinido: boolean;
  cargo?: string | null;
  sueldo_pactado?: number | null;
  archivo_url?: string | null;
  estado: EstadoContrato;
  dias_restantes?: number | null;
  observaciones?: string | null;
  usuario_registro_id?: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContratoDTO {
  personal_id: number;
  tipo_contrato_id?: number | null;
  tipo_contrato_nombre?: string | null;
  numero_contrato?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  es_indefinido?: boolean;
  cargo?: string | null;
  sueldo_pactado?: number | null;
  archivo_url?: string | null;
  estado?: EstadoContrato;
  observaciones?: string | null;
}

export interface UpdateContratoDTO {
  tipo_contrato_id?: number | null;
  tipo_contrato_nombre?: string | null;
  numero_contrato?: string | null;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  es_indefinido?: boolean;
  cargo?: string | null;
  sueldo_pactado?: number | null;
  archivo_url?: string | null;
  estado?: EstadoContrato;
  observaciones?: string | null;
}

export interface FiltrosContratos {
  personal_id?: number;
  estado?: EstadoContrato;
  por_vencer?: boolean; // Contratos que vencen en los próximos 30 días
  search?: string;
}
