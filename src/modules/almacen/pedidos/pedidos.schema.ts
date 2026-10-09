import { z } from 'zod';
import { zMultiNumber, zMultiString } from '../shared/almacen.filters';

const id = z.coerce.number().int().positive('ID inválido');

export const pedidoIdSchema = z.object({ params: z.object({ id }) });

export const pedidoItemSchema = z.object({
  producto_id: z.number().int().positive('El producto es requerido'),
  cantidad_solicitada: z.number().positive('La cantidad debe ser mayor a 0'),
  observacion: z.string().max(255).nullish(),
});

export const crearPedidoSchema = z.object({
  body: z.object({
    almacen_id: z.number().int().positive('El almacén es requerido'),
    solicitante_personal_id: z.number().int().positive().optional(),
    area_id: z.number().int().positive().optional(),
    observaciones: z.string().max(1000).nullish(),
    items: z.array(pedidoItemSchema).min(1, 'Debe incluir al menos un ítem a solicitar'),
  }),
});

export const aprobarPedidoItemSchema = z.object({
  detalle_id: z.number().int().positive(),
  cantidad_aprobada: z.number().min(0),
});

export const aprobarPedidoSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    items: z.array(aprobarPedidoItemSchema).optional(),
  }),
});

export const rechazarPedidoSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe indicar un motivo de rechazo (mínimo 5 caracteres)'),
  }),
});

export const anularPedidoSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe indicar un motivo de anulación (mínimo 5 caracteres)'),
  }),
});

export const listarPedidosSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(10),
    almacen_id: zMultiNumber(),
    solicitante_personal_id: z.coerce.number().int().positive().optional(),
    estado: zMultiString(),
    fecha_desde: z.string().optional(),
    fecha_hasta: z.string().optional(),
    search: z.string().optional(),
  }),
});

export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>['body'];
export type AprobarPedidoInput = z.infer<typeof aprobarPedidoSchema>['body'];
export type RechazarPedidoInput = z.infer<typeof rechazarPedidoSchema>['body'];
export type AnularPedidoInput = z.infer<typeof anularPedidoSchema>['body'];
export type ListarPedidosQuery = z.infer<typeof listarPedidosSchema>['query'];
