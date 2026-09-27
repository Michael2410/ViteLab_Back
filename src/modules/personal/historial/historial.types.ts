export type TipoEventoLaboral = 
  | 'ALTA_INICIAL' 
  | 'CESE' 
  | 'REINGRESO' 
  | 'CAMBIO_CARGO' 
  | 'CAMBIO_SUELDO' 
  | 'CAMBIO_CONTRATO' 
  | 'OTRO';

export interface HistorialLaboralItem {
  id: number;
  personal_id: number;
  tipo_evento: TipoEventoLaboral;
  fecha_evento: string;
  cargo?: string | null;
  area?: string | null;
  tipo_contrato?: string | null;
  sueldo_base?: number | null;
  motivo_cese_id?: number | null;
  motivo_cese_texto?: string | null;
  observaciones?: string | null;
  usuario_id?: number | null;
  usuario_nombre?: string | null;
  created_at: Date;
}

export interface RegistrarEventoHistorialDTO {
  personal_id: number;
  tipo_evento: TipoEventoLaboral;
  fecha_evento: string;
  cargo?: string | null;
  area?: string | null;
  tipo_contrato?: string | null;
  sueldo_base?: number | null;
  motivo_cese_id?: number | null;
  motivo_cese_texto?: string | null;
  observaciones?: string | null;
}
