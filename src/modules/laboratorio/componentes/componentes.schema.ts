import { z } from 'zod';

export const createComponenteSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es requerido').max(200),
    valores_referenciales: z.array(z.string()).optional(),
    unidad_medida: z.string().max(50).optional(),
    area_id: z.number().int().positive().optional(),
    metodo_id: z.number().int().positive().optional(),
    muestras_ids: z.array(z.number().int().positive()).optional(),
    valor_alerta_min: z.number().nullable().optional(),
    valor_alerta_max: z.number().nullable().optional(),
  }),
});

export const updateComponenteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(200).optional(),
    valores_referenciales: z.array(z.string()).optional(),
    unidad_medida: z.string().max(50).nullable().optional(),
    area_id: z.number().int().positive().nullable().optional(),
    metodo_id: z.number().int().positive().nullable().optional(),
    muestras_ids: z.array(z.number().int().positive()).optional(),
    valor_alerta_min: z.number().nullable().optional(),
    valor_alerta_max: z.number().nullable().optional(),
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
