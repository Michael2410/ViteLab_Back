export type EstadoAsistencia =
  | 'PRESENTE'
  | 'TARDANZA'
  | 'FALTA_INJUSTIFICADA'
  | 'FALTA_JUSTIFICADA'
  | 'PERMISO'
  | 'VACACIONES';

export interface RegistroAsistenciaItem {
  id: number;
  personal_id: number;
  colaborador_nombre: string;
  colaborador_documento?: string;
  cargo: string;
  area: string;
  fecha: string;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  minutos_tardanza: number;
  estado: EstadoAsistencia;
  justificacion?: string | null;
  sede_id?: number | null;
  sede_nombre?: string | null;
  created_at: Date;
  updated_at?: Date;
}

export interface RegistrarAsistenciaDTO {
  personal_id: number;
  fecha: string;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  minutos_tardanza?: number;
  estado: EstadoAsistencia;
  justificacion?: string | null;
  sede_id?: number | null;
}

export interface FiltrosAsistencia {
  fecha?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  personal_id?: number;
  estado?: EstadoAsistencia | EstadoAsistencia[] | string | string[];
  search?: string;
}
