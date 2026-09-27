import { z } from 'zod';

export const createPersonalSchema = z.object({
  tipo_documento: z.string().max(20).optional().default('DNI'),
  numero_documento: z.string().max(30).nullable().optional(),
  nombres: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  apellidos: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres').max(100),
  cargo: z.string().max(100).nullable().optional(),
  cargo_id: z.number().int().positive().nullable().optional(),
  area: z.string().max(100).nullable().optional(),
  area_id: z.number().int().positive().nullable().optional(),
  email: z.string().email('Email inválido').max(100).nullable().optional().or(z.literal('')),
  telefono: z.string().max(30).nullable().optional().or(z.literal('')),
  direccion: z.string().nullable().optional().or(z.literal('')),
  fecha_nacimiento: z.string().nullable().optional().or(z.literal('')),
  fecha_ingreso: z.string().nullable().optional().or(z.literal('')),
  tipo_contrato: z.string().max(50).nullable().optional().or(z.literal('')),
  tipo_contrato_id: z.number().int().positive().nullable().optional(),
  sueldo_base: z.number().nonnegative().nullable().optional(),
  colegiatura: z.string().max(50).nullable().optional().or(z.literal('')),
  firma_url: z.string().nullable().optional().or(z.literal('')),
  sede_ids: z.array(z.number().int().positive()).optional(),
  crear_usuario: z.boolean().optional(),
  usuario_data: z.object({
    username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
    email: z.string().email('Email inválido').max(100),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    rol_id: z.number().int().positive('El rol es requerido'),
  }).optional(),
});

export const updatePersonalSchema = z.object({
  tipo_documento: z.string().max(20).optional(),
  numero_documento: z.string().max(30).nullable().optional(),
  nombres: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100).optional(),
  apellidos: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres').max(100).optional(),
  cargo: z.string().max(100).nullable().optional(),
  cargo_id: z.number().int().positive().nullable().optional(),
  area: z.string().max(100).nullable().optional(),
  area_id: z.number().int().positive().nullable().optional(),
  email: z.string().email('Email inválido').max(100).nullable().optional().or(z.literal('')),
  telefono: z.string().max(30).nullable().optional().or(z.literal('')),
  direccion: z.string().nullable().optional().or(z.literal('')),
  fecha_nacimiento: z.string().nullable().optional().or(z.literal('')),
  fecha_ingreso: z.string().nullable().optional().or(z.literal('')),
  tipo_contrato: z.string().max(50).nullable().optional().or(z.literal('')),
  tipo_contrato_id: z.number().int().positive().nullable().optional(),
  sueldo_base: z.number().nonnegative().nullable().optional(),
  colegiatura: z.string().max(50).nullable().optional().or(z.literal('')),
  firma_url: z.string().nullable().optional().or(z.literal('')),
  activo: z.boolean().optional(),
  sede_ids: z.array(z.number().int().positive()).optional(),
});

export const vincularCuentaSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').max(50),
  email: z.string().email('Email inválido').max(100),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol_id: z.number().int().positive('El rol es requerido'),
});

export const darDeBajaSchema = z.object({
  fecha_cese: z.string().min(1, 'La fecha de cese es requerida'),
  motivo_cese_id: z.number().int().positive().nullable().optional(),
  motivo_cese: z.string().max(100).nullable().optional().or(z.literal('')),
  observaciones_cese: z.string().max(500).nullable().optional().or(z.literal('')),
}).refine(data => data.motivo_cese_id || (data.motivo_cese && data.motivo_cese.trim().length > 0), {
  message: 'El motivo de cese es requerido',
  path: ['motivo_cese'],
});

export const updateCuentaSchema = z.object({
  activo: z.boolean().optional(),
  rol_id: z.number().int().positive().optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  email: z.string().email('Email inválido').max(100).optional(),
});

export type CreatePersonalInput = z.infer<typeof createPersonalSchema>;
export type UpdatePersonalInput = z.infer<typeof updatePersonalSchema>;
export type VincularCuentaInput = z.infer<typeof vincularCuentaSchema>;
export type DarDeBajaInput = z.infer<typeof darDeBajaSchema>;
export type UpdateCuentaInput = z.infer<typeof updateCuentaSchema>;
