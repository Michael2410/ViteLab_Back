import { z } from 'zod';
import { zMultiNumber, zMultiString } from '../shared/almacen.filters';

const id = z.coerce.number().int().positive('ID inválido');

export const ajusteIdSchema = z.object({ params: z.object({ id }) });

export const itemAjusteSchema = z.object({
  producto_id: z.number().int().positive('El producto es requerido'),
  lote_id: z.number().int().positive('El lote es requerido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  sentido: z.enum(['ENTRADA', 'SALIDA']),
  costo_unitario: z.number().min(0).default(0),
  observacion: z.string().max(255).optional(),
});

export const crearAjusteSchema = z.object({
  body: z.object({
    almacen_id: z.number().int().positive('El almacén es requerido'),
    tipo: z.enum(['CONTEO_FISICO', 'MERMA', 'BAJA', 'REGULARIZACION']),
    motivo: z.string().max(50).optional(),
    observaciones: z.string().max(1000).optional(),
    items: z.array(itemAjusteSchema).min(1, 'Debe incluir al menos un ítem para ajustar'),
  }),
});

export const aprobarAjusteSchema = z.object({
  params: z.object({ id }),
});

export const rechazarAjusteSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe indicar un motivo de rechazo (mínimo 5 caracteres)'),
  }),
});

export const listarAjustesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(10),
    almacen_id: zMultiNumber(),
    tipo: zMultiString(),
    estado: zMultiString(),
    fecha_desde: z.string().optional(),
    fecha_hasta: z.string().optional(),
    search: z.string().optional(),
  }),
});

export type CrearAjusteInput = z.infer<typeof crearAjusteSchema>['body'];
export type RechazarAjusteInput = z.infer<typeof rechazarAjusteSchema>['body'];
export type ListarAjustesQuery = z.infer<typeof listarAjustesSchema>['query'];
