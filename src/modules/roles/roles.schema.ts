import { z } from 'zod';

// Schema para crear rol
export const createRolSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(50, 'El nombre no puede exceder 50 caracteres'),
  descripcion: z.string().max(255, 'La descripción no puede exceder 255 caracteres').optional(),
  permisos: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un permiso'),
});

// Schema para actualizar rol
export const updateRolSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(50, 'El nombre no puede exceder 50 caracteres').optional(),
  descripcion: z.string().max(255, 'La descripción no puede exceder 255 caracteres').optional().nullable(),
  permisos: z.array(z.number().int().positive()).optional(),
  activo: z.boolean().optional(),
});

// Schema para obtener rol por ID
export const getRolByIdSchema = z.object({
  params: z.object({
    id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, 'ID inválido'),
  }),
});
