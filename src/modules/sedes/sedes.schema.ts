import { z } from 'zod';

export const createSedeSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es requerido').max(100),
    direccion: z.string().max(255).optional(),
    telefono: z.string().max(20).optional(),
    email: z.string().email('Email inválido').optional(),
  }),
});

export const updateSedeSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(100).optional(),
    direccion: z.string().max(255).optional(),
    telefono: z.string().max(20).optional(),
    email: z.string().email('Email inválido').optional(),
    activo: z.boolean().optional(),
  }),
});

export const getSedeByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteSedeSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});
