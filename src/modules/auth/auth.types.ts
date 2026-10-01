// Tipos para el módulo de autenticación

export interface SedeAsignada {
  id: number;
  nombre: string;
}

export interface Usuario {
  id: number;
  personal_id: number | null;
  username: string;
  email: string;
  rol_id: number;
  activo: boolean;
  two_factor_enabled?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UsuarioConRol extends Usuario {
  nombres: string;
  apellidos: string;
  firma_url: string | null;
  rol_nombre: string;
  rol_descripcion: string;
  sedes?: SedeAsignada[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface Login2FARequiredResponse {
  requires2FA: true;
  setupNeeded: boolean;
  tempToken: string;
  qrCodeDataUrl?: string;
  manualKey?: string;
  emailMasked?: string;
}

export interface LoginSuccessResponse {
  requires2FA?: false;
  user: Omit<UsuarioConRol, 'password_hash' | 'refresh_token' | 'refresh_token_expires_at'>;
  accessToken: string;
  refreshToken: string;
  backupCodes?: string[];
}

export type LoginResponse = LoginSuccessResponse | Login2FARequiredResponse;

export interface Verify2FARequest {
  tempToken: string;
  code: string;
}

export interface Confirm2FASetupRequest {
  tempToken: string;
  code: string;
}

export interface TwoFactorJwtPayload {
  userId: number;
  username: string;
  email: string;
  stage: '2fa_pending' | '2fa_setup_pending';
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
  rol_id: number;
  personal_id?: number | null;
  nombres?: string;
  apellidos?: string;
  firma_url?: string;
  sede_ids?: number[];
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  rol_id?: number;
  personal_id?: number | null;
  nombres?: string;
  apellidos?: string;
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
