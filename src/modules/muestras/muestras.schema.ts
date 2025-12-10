import { z } from 'zod';

export const createMuestraSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es requerido').max(100),
    descripcion: z.string().optional(),
  }),
});

export const updateMuestraSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(100).optional(),
    descripcion: z.string().nullable().optional(),
    activo: z.boolean().optional(),
  }),
});

export const getMuestraByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteMuestraSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});
