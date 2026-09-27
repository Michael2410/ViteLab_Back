export type TipoDocumentoLaboral =
  | 'CONSTANCIA_TRABAJO'
  | 'CERTIFICADO_LABORAL'
  | 'CARTA_PRESENTACION'
  | 'RECOMENDACION';

export interface DocumentoLaboralItem {
  id: number;
  personal_id: number;
  colaborador_nombre: string;
  colaborador_documento: string;
  tipo_documento: TipoDocumentoLaboral;
  codigo_emision: string;
  fecha_emision: string;
  destinatario: string;
  cargo_consignado: string;
  remuneracion_consignada?: number | null;
  archivo_url?: string | null;
  observaciones?: string | null;
  emitido_por_id?: number | null;
  emitido_por_nombre?: string | null;
  created_at: Date;
}

export interface GenerarDocumentoDTO {
  personal_id: number;
  tipo_documento: TipoDocumentoLaboral;
  destinatario?: string | null;
  incluir_remuneracion?: boolean;
  observaciones?: string | null;
}

export interface FiltrosDocumentos {
  personal_id?: number;
  tipo_documento?: TipoDocumentoLaboral;
  search?: string;
}
