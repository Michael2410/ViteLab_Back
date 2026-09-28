import { z } from 'zod';

const id = z.coerce.number().int().positive('ID inválido');

export const despachoIdSchema = z.object({ params: z.object({ id }) });

export const despachoItemSchema = z.object({
  producto_id: z.number().int().positive('El producto es requerido'),
  lote_id: z.number().int().positive('El lote es requerido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  pedido_detalle_id: z.number().int().positive().optional(),
});

export const crearDespachoSchema = z.object({
  body: z.object({
    almacen_id: z.number().int().positive('El almacén es requerido'),
    receptor_personal_id: z.number().int().positive('El trabajador receptor es requerido'),
    area_id: z.number().int().positive().optional(),
    pedido_id: z.number().int().positive().optional(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    observaciones: z.string().max(1000).optional(),
    items: z.array(despachoItemSchema).min(1, 'Debe incluir al menos un ítem para despachar'),
  }),
});

export const anularDespachoSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe indicar un motivo de anulación (mínimo 5 caracteres)'),
  }),
});

export const listarDespachosSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(10),
    almacen_id: z.coerce.number().int().positive().optional(),
    receptor_personal_id: z.coerce.number().int().positive().optional(),
    estado: z.enum(['REGISTRADO', 'ANULADO']).optional(),
    fecha_desde: z.string().optional(),
    fecha_hasta: z.string().optional(),
    search: z.string().optional(),
  }),
});

export type CrearDespachoInput = z.infer<typeof crearDespachoSchema>['body'];
export type AnularDespachoInput = z.infer<typeof anularDespachoSchema>['body'];
export type ListarDespachosQuery = z.infer<typeof listarDespachosSchema>['query'];
