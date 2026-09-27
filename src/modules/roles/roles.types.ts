import type { InferSelectModel } from 'drizzle-orm';
import { roles, permisos } from '../../db';

export type Rol = InferSelectModel<typeof roles>;
export type Permiso = InferSelectModel<typeof permisos>;

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
