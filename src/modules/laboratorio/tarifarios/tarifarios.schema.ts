import { z } from 'zod';

export const createTarifarioSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, 'El nombre es requerido').max(100),
    descripcion: z.string().max(255).optional(),
  }),
});

export const updateTarifarioSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    nombre: z.string().min(1).max(100).optional(),
    descripcion: z.string().max(255).optional(),
    activo: z.boolean().optional(),
  }),
});

export const getTarifarioByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteTarifarioSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const createTarifarioPrecioSchema = z.object({
  body: z.object({
    tarifario_id: z.number().int().positive('El ID del tarifario es requerido'),
    analisis_id: z.number().int().positive('El ID del análisis es requerido'),
    precio: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  }),
});

export const updateTarifarioPrecioSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    precio: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  }),
});

export const deleteTarifarioPrecioSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});
