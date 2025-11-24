import { z } from 'zod';

export const createConvenioSchema = z.object({
  body: z.object({
    nombre_empresa: z.string().min(1, 'El nombre de la empresa es requerido').max(200),
    ruc: z.string().length(11, 'El RUC debe tener 11 dígitos').regex(/^\d+$/, 'El RUC solo debe contener números'),
    direccion: z.string().max(255).optional(),
    telefono: z.string().max(20).optional(),
    email: z.string().email('Email inválido').max(100).optional(),
    tarifario_id: z.number().int().positive().optional(),
  }),
});

export const updateConvenioSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    nombre_empresa: z.string().min(1).max(200).optional(),
    ruc: z.string().length(11).regex(/^\d+$/).optional(),
    direccion: z.string().max(255).optional(),
    telefono: z.string().max(20).optional(),
    email: z.string().email().max(100).optional(),
    tarifario_id: z.number().int().positive().optional(),
    activo: z.boolean().optional(),
  }),
});

export const getConvenioByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteConvenioSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});
