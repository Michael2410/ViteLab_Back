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

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  role?: string;
  isOwner?: boolean;
}

export interface Login2FARequiredResponse {
  requires2FA: true;
  requiresTenantSelection?: false;
  setupNeeded: boolean;
  tempToken: string;
  qrCodeDataUrl?: string;
  manualKey?: string;
  emailMasked?: string;
}

export interface LoginTenantRequiredResponse {
  requiresTenantSelection: true;
  requires2FA?: false;
  requiresPasswordChange?: false;
  tempToken: string;
  tenants: TenantSummary[];
}

export interface LoginPasswordChangeRequiredResponse {
  requiresPasswordChange: true;
  requires2FA?: false;
  requiresTenantSelection?: false;
  tempToken: string;
  email: string;
  nombres?: string;
}

export interface LoginSuccessResponse {
  requires2FA?: false;
  requiresTenantSelection?: false;
  requiresPasswordChange?: false;
  user: Omit<UsuarioConRol, 'password_hash' | 'refresh_token' | 'refresh_token_expires_at'>;
  activeTenant?: TenantSummary;
  accessToken: string;
  refreshToken: string;
  backupCodes?: string[];
}

export type LoginResponse =
  | LoginSuccessResponse
  | Login2FARequiredResponse
  | LoginTenantRequiredResponse
  | LoginPasswordChangeRequiredResponse;

export interface SelectTenantRequest {
  tempToken: string;
  tenantId: string;
}

export interface SwitchTenantRequest {
  tenantId: string;
}

export interface Verify2FARequest {
  tempToken: string;
  code: string;
}

export interface Confirm2FASetupRequest {
  tempToken: string;
  code: string;
}

export interface ChangeInitialPasswordRequest {
  tempToken: string;
  newPassword: string;
}

export interface ResetUserPasswordRequest {
  newPassword?: string;
}

export interface TwoFactorJwtPayload {
  userId?: number;
  username?: string;
  email: string;
  stage: '2fa_pending' | '2fa_setup_pending' | 'tenant_selection' | 'password_change_pending';
  identityId?: string;
  tenantId?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: number; // SERIAL en BD de tenant
  username: string;
  email: string;
  rolId: number;
  sub?: string; // UUID de identidad en Master
  tenantId?: string; // UUID de tenant en Master
  sessionId?: string; // UUID de sesión en Master
  scope?: string; // 'tenant'
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
