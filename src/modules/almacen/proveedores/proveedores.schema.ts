import { z } from 'zod';

const id = z.coerce.number().int().positive('ID inválido');

export const listarProveedoresSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(20),
  }),
});

export const proveedorIdSchema = z.object({ params: z.object({ id }) });

const proveedorBody = z.object({
  ruc: z
    .string()
    .trim()
    .regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos numéricos')
    .nullable()
    .optional(),
  razon_social: z.string().trim().min(1, 'La razón social es requerida').max(200),
  nombre_comercial: z.string().trim().max(200).nullable().optional(),
  direccion: z.string().trim().max(500).nullable().optional(),
  contacto: z.string().trim().max(150).nullable().optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email('Email inválido').max(100).nullable().optional(),
});

export const crearProveedorSchema = z.object({ body: proveedorBody });
export const actualizarProveedorSchema = z.object({
  params: z.object({ id }),
  body: proveedorBody
    .partial()
    .extend({ activo: z.boolean().optional() })
    .refine((b) => Object.keys(b).length > 0, { message: 'Envíe al menos un campo para actualizar' }),
});

export type ListarProveedoresQuery = z.infer<typeof listarProveedoresSchema>['query'];
export type CrearProveedorInput = z.infer<typeof crearProveedorSchema>['body'];
export type ActualizarProveedorInput = z.infer<typeof actualizarProveedorSchema>['body'];
