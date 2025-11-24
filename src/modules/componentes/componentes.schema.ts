import { z } from 'zod';

export const createComponenteSchema = z.object({
  body: z.object({
    analisis_id: z.number().int().positive('El ID del análisis es requerido'),
    nombre: z.string().min(1, 'El nombre es requerido').max(200),
    valor_referencial: z.string().min(1, 'El valor referencial es requerido'),
    area_id: z.number().int().positive().optional(),
    metodo_id: z.number().int().positive().optional(),
    orden: z.number().int().min(0).optional(),
  }),
});

export const updateComponenteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    analisis_id: z.number().int().positive().optional(),
    nombre: z.string().min(1).max(200).optional(),
    valor_referencial: z.string().min(1).optional(),
    area_id: z.number().int().positive().optional(),
    metodo_id: z.number().int().positive().optional(),
    orden: z.number().int().min(0).optional(),
    activo: z.boolean().optional(),
  }),
});

export const getComponenteByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteComponenteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const getComponentesByAnalisisSchema = z.object({
  params: z.object({
    analisisId: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});
