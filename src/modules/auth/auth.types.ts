// Tipos para el módulo de autenticación

export interface SedeAsignada {
  id: number;
  nombre: string;
}

export interface Usuario {
  id: number;
  username: string;
  email: string;
  nombres: string;
  apellidos: string;
  rol_id: number;
  firma_url: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UsuarioConRol extends Usuario {
  rol_nombre: string;
  rol_descripcion: string;
  sedes?: SedeAsignada[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<UsuarioConRol, 'password_hash' | 'refresh_token' | 'refresh_token_expires_at'>;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  email: string;
  rolId: number;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  nombres: string;
  apellidos: string;
  rol_id: number;
  firma_url?: string;
  sede_ids?: number[];
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  nombres?: string;
  apellidos?: string;
  rol_id?: number;
  firma_url?: string;
  activo?: boolean;
  sede_ids?: number[];
}

export interface Permiso {
  id: number;
  modulo: string;
  submodulo: string | null;
  accion: string;
  codigo: string;
  descripcion: string;
}

export interface UsuarioConPermisos extends UsuarioConRol {
  permisos: string[]; // Array de códigos de permisos
}
