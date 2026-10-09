// Tipos para el módulo de Directorio de Personal (RRHH)

export interface PersonalSede {
  id: number;
  nombre: string;
}

export interface PersonalUsuarioInfo {
  id: number;
  username: string;
  email: string;
  rol_id: number;
  rol_nombre: string;
  activo: boolean;
}

export interface Personal {
  id: number;
  tipo_documento: string;
  numero_documento: string | null;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  cargo_id?: number | null;
  area: string | null;
  area_id?: number | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_nacimiento: string | null;
  fecha_ingreso: string | null;
  tipo_contrato: string | null;
  tipo_contrato_id?: number | null;
  sueldo_base: number | null;
  colegiatura: string | null;
  firma_url: string | null;
  activo: boolean;
  fecha_cese?: string | null;
  motivo_cese?: string | null;
  motivo_cese_id?: number | null;
  observaciones_cese?: string | null;
  created_at: Date;
  updated_at: Date;
  sedes?: PersonalSede[];
  usuario?: PersonalUsuarioInfo | null;
}

export interface CreatePersonalDTO {
  tipo_documento?: string;
  numero_documento?: string | null;
  nombres: string;
  apellidos: string;
  cargo?: string | null;
  cargo_id?: number | null;
  area?: string | null;
  area_id?: number | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fecha_nacimiento?: string | null;
  fecha_ingreso?: string | null;
  tipo_contrato?: string | null;
  tipo_contrato_id?: number | null;
  sueldo_base?: number | null;
  colegiatura?: string | null;
  firma_url?: string | null;
  sede_ids?: number[];
  // Opcional: creación simultánea de cuenta de sistema
  crear_usuario?: boolean;
  usuario_data?: {
    username: string;
    email: string;
    password: string;
    rol_id: number;
  };
}

export interface UpdatePersonalDTO {
  tipo_documento?: string;
  numero_documento?: string | null;
  nombres?: string;
  apellidos?: string;
  cargo?: string | null;
  cargo_id?: number | null;
  area?: string | null;
  area_id?: number | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  fecha_nacimiento?: string | null;
  fecha_ingreso?: string | null;
  tipo_contrato?: string | null;
  tipo_contrato_id?: number | null;
  sueldo_base?: number | null;
  colegiatura?: string | null;
  firma_url?: string | null;
  activo?: boolean;
  fecha_cese?: string | null;
  motivo_cese?: string | null;
  motivo_cese_id?: number | null;
  observaciones_cese?: string | null;
  sede_ids?: number[];
}

export interface VincularCuentaDTO {
  username: string;
  email: string;
  password: string;
  rol_id: number;
}

export interface DarDeBajaPersonalDTO {
  fecha_cese: string;
  motivo_cese?: string | null;
  motivo_cese_id?: number | null;
  observaciones_cese?: string | null;
}

export interface UpdateCuentaPersonalDTO {
  activo?: boolean;
  rol_id?: number;
  password?: string;
  email?: string;
}

export interface FiltrosPersonal {
  search?: string;
  cargo?: string | string[];
  cargo_id?: number | number[];
  area?: string | string[];
  area_id?: number | number[];
  tipo_contrato_id?: number | number[];
  activo?: boolean;
  sede_id?: number | number[];
  con_usuario?: boolean;
}
