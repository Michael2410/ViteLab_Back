import { z } from 'zod';

// Schema para login
export const loginSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

// Schema para refresh token
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'El refresh token es requerido'),
});

// Schema para crear usuario
export const createUserSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
  email: z.string().email('Email inválido').max(100),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol_id: z.number().int().positive('El rol es requerido'),
  personal_id: z.number().int().positive().nullable().optional(),
  nombres: z.string().min(2, 'El nombre es requerido').max(100).optional(),
  apellidos: z.string().min(2, 'Los apellidos son requeridos').max(100).optional(),
  firma_url: z.string().optional(),
  sede_ids: z.array(z.number().int().positive()).optional(),
});

// Schema para actualizar usuario
export const updateUserSchema = z.object({
  email: z.string().email('Email inválido').max(100).optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  rol_id: z.number().int().positive('El rol es requerido').optional(),
  personal_id: z.number().int().positive().nullable().optional(),
  nombres: z.string().min(2, 'El nombre es requerido').max(100).optional(),
  apellidos: z.string().min(2, 'Los apellidos son requeridos').max(100).optional(),
  firma_url: z.string().optional(),
  activo: z.boolean().optional(),
  sede_ids: z.array(z.number().int().positive()).optional(),
});

// Schema para verificar 2FA
export const verify2FASchema = z.object({
  tempToken: z.string().min(1, 'El token temporal es requerido'),
  code: z.string().min(4, 'El código es requerido').max(20),
});

// Schema para confirmar vinculación 2FA inicial
export const confirm2FASetupSchema = z.object({
  tempToken: z.string().min(1, 'El token temporal es requerido'),
  code: z.string().min(6, 'El código de 6 dígitos es requerido').max(8),
});

// Schema para seleccionar tenant en multi-membresía
export const selectTenantSchema = z.object({
  tempToken: z.string().min(1, 'El token temporal es requerido'),
  tenantId: z.string().uuid('ID de tenant inválido'),
});

// Schema para alternar entre laboratorios autenticado
export const switchTenantSchema = z.object({
  tenantId: z.string().uuid('ID de tenant inválido'),
});

// Schema para cambio obligatorio de contraseña inicial/provisional
export const changeInitialPasswordSchema = z.object({
  tempToken: z.string().min(1, 'El token temporal es requerido'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
});

// Schema para reseteo de contraseña por administrador
export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
});

// Tipos inferidos de los schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type Verify2FAInput = z.infer<typeof verify2FASchema>;
export type Confirm2FASetupInput = z.infer<typeof confirm2FASetupSchema>;
export type SelectTenantInput = z.infer<typeof selectTenantSchema>;
export type SwitchTenantInput = z.infer<typeof switchTenantSchema>;
export type ChangeInitialPasswordInput = z.infer<typeof changeInitialPasswordSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
