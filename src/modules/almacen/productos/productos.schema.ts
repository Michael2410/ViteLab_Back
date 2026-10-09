import { z } from 'zod';
import { zMultiNumber } from '../shared/almacen.filters';

const id = z.coerce.number().int().positive('ID inválido');

export const listarProductosSchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    categoria_id: zMultiNumber(),
    activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(20),
  }),
});

export const productoIdSchema = z.object({ params: z.object({ id }) });

const productoBody = z.object({
  codigo: z.string().trim().min(1).max(50).nullable().optional(),
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(200),
  descripcion: z.string().trim().max(500).nullable().optional(),
  categoria_id: z.number().int().positive().nullable().optional(),
  unidad_medida_id: z.number().int().positive('La unidad de medida es requerida'),
  area_id: z.number().int().positive().nullable().optional(),
  stock_minimo: z
    .number()
    .nonnegative('El stock mínimo no puede ser negativo')
    .max(99_999_999_999, 'Valor demasiado grande')
    .optional(),
  controla_lote: z.boolean().optional(),
  controla_vencimiento: z.boolean().optional(),
  requiere_cadena_frio: z.boolean().optional(),
  temp_min: z.number().min(-90).max(60).nullable().optional(),
  temp_max: z.number().min(-90).max(60).nullable().optional(),
  dias_alerta_vencimiento: z.number().int().min(0).max(365).optional(),
});

export const crearProductoSchema = z.object({ body: productoBody });
export const actualizarProductoSchema = z.object({
  params: z.object({ id }),
  body: productoBody
    .partial()
    .extend({ activo: z.boolean().optional() })
    .refine((b) => Object.keys(b).length > 0, { message: 'Envíe al menos un campo para actualizar' }),
});

export type ListarProductosQuery = z.infer<typeof listarProductosSchema>['query'];
export type CrearProductoInput = z.infer<typeof crearProductoSchema>['body'];
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>['body'];
