import { z } from 'zod';

export const createMetodoSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es requerido').max(100),
    descripcion: z.string().max(255).optional(),
  }),
});

export const updateMetodoSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(100).optional(),
    descripcion: z.string().max(255).optional(),
    activo: z.boolean().optional(),
  }),
});

export const getMetodoByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteMetodoSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});
