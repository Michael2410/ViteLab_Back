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
  nombres: z.string().min(2, 'El nombre es requerido').max(100),
  apellidos: z.string().min(2, 'Los apellidos son requeridos').max(100),
  rol_id: z.number().int().positive('El rol es requerido'),
  firma_url: z.string().optional(),
});

// Schema para actualizar usuario
export const updateUserSchema = z.object({
  email: z.string().email('Email inválido').max(100).optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  nombres: z.string().min(2, 'El nombre es requerido').max(100).optional(),
  apellidos: z.string().min(2, 'Los apellidos son requeridos').max(100).optional(),
  rol_id: z.number().int().positive('El rol es requerido').optional(),
  firma_url: z.string().optional(),
  activo: z.boolean().optional(),
});

// Tipos inferidos de los schemas
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
