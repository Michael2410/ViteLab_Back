export type EstadoVacacion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'TOMADA' | 'CANCELADA';

export interface SolicitudVacacionItem {
  id: number;
  personal_id: number;
  colaborador_nombre?: string;
  colaborador_cargo?: string;
  colaborador_area?: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_solicitados: number;
  estado: EstadoVacacion;
  motivo?: string | null;
  observaciones_aprobador?: string | null;
  aprobado_por_id?: number | null;
  aprobado_por_nombre?: string | null;
  fecha_aprobacion?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSolicitudVacacionDTO {
  personal_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  dias_solicitados: number;
  motivo?: string | null;
}

export interface CambiarEstadoVacacionDTO {
  estado: EstadoVacacion;
  observaciones_aprobador?: string | null;
}

export interface FiltrosVacaciones {
  personal_id?: number;
  estado?: EstadoVacacion;
  fecha_desde?: string;
  fecha_hasta?: string;
}
