// Tipos para el módulo de roles y permisos

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Permiso {
  id: number;
  modulo: string;
  submodulo: string | null;
  accion: string;
  codigo: string;
  descripcion: string | null;
  created_at: Date;
}

export interface PermisoAgrupado {
  modulo: string;
  submodulos: {
    nombre: string | null;
    permisos: Permiso[];
  }[];
}

export interface RolConPermisos extends Rol {
  permisos: string[]; // Array de códigos de permisos
  total_usuarios?: number;
}

export interface CreateRolRequest {
  nombre: string;
  descripcion?: string;
  permisos: number[]; // Array de IDs de permisos
}

export interface UpdateRolRequest {
  nombre?: string;
  descripcion?: string;
  permisos?: number[]; // Array de IDs de permisos
  activo?: boolean;
}

export interface RolFilters {
  activo?: boolean;
  search?: string;
}
