import { z } from 'zod';

export const createAnalisisSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es requerido').max(200),
    descripcion: z.string().max(500).optional().nullable(),
    sinonimia: z.array(z.string()).optional(),
    componentes_ids: z.array(z.number()).optional(),
  }),
});

export const updateAnalisisSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(200).optional(),
    descripcion: z.string().max(500).optional().nullable(),
    sinonimia: z.array(z.string()).optional(),
    activo: z.boolean().optional(),
    componentes_ids: z.array(z.number()).optional(),
  }),
});

export const getAnalisisByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteAnalisisSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const searchAnalisisSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'El término de búsqueda es requerido'),
  }),
});
