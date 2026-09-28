import { z } from 'zod';

const id = z.coerce.number().int().positive('ID inválido');

export const consumoIdSchema = z.object({ params: z.object({ id }) });
export const devolucionIdSchema = z.object({ params: z.object({ id }) });

export const consumoItemSchema = z.object({
  almacen_origen_id: z.number().int().positive('El almacén de origen es requerido'),
  producto_id: z.number().int().positive('El producto es requerido'),
  lote_id: z.number().int().positive('El lote es requerido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  observacion: z.string().max(255).optional(),
});

export const crearConsumoSchema = z.object({
  body: z.object({
    sede_id: z.number().int().positive('La sede es requerida'),
    personal_id: z.number().int().positive().optional(),
    area_id: z.number().int().positive().optional(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    observaciones: z.string().max(1000).optional(),
    items: z.array(consumoItemSchema).min(1, 'Debe incluir al menos un ítem a consumir'),
  }),
});

export const anularConsumoSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe indicar un motivo de anulación'),
  }),
});

export const listarConsumosSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(10),
    sede_id: z.coerce.number().int().positive().optional(),
    personal_id: z.coerce.number().int().positive().optional(),
    estado: z.enum(['REGISTRADO', 'ANULADO']).optional(),
    fecha_desde: z.string().optional(),
    fecha_hasta: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const devolucionItemSchema = z.object({
  producto_id: z.number().int().positive('El producto es requerido'),
  lote_id: z.number().int().positive('El lote es requerido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  observacion: z.string().max(255).optional(),
});

export const crearDevolucionSchema = z.object({
  body: z.object({
    almacen_id: z.number().int().positive('El almacén destino es requerido'),
    personal_id: z.number().int().positive().optional(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    observaciones: z.string().max(1000).optional(),
    items: z.array(devolucionItemSchema).min(1, 'Debe incluir al menos un ítem a devolver'),
  }),
});

export const anularDevolucionSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe indicar un motivo de anulación'),
  }),
});

export const listarDevolucionesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(10),
    almacen_id: z.coerce.number().int().positive().optional(),
    personal_id: z.coerce.number().int().positive().optional(),
    estado: z.enum(['REGISTRADO', 'ANULADO']).optional(),
    fecha_desde: z.string().optional(),
    fecha_hasta: z.string().optional(),
    search: z.string().optional(),
  }),
});

export type CrearConsumoInput = z.infer<typeof crearConsumoSchema>['body'];
export type AnularConsumoInput = z.infer<typeof anularConsumoSchema>['body'];
export type ListarConsumosQuery = z.infer<typeof listarConsumosSchema>['query'];

export type CrearDevolucionInput = z.infer<typeof crearDevolucionSchema>['body'];
export type AnularDevolucionInput = z.infer<typeof anularDevolucionSchema>['body'];
export type ListarDevolucionesQuery = z.infer<typeof listarDevolucionesSchema>['query'];
