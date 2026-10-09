import { z } from 'zod';
import { zMultiNumber, zMultiString } from '../shared/almacen.filters';

const id = z.coerce.number().int().positive('ID inválido');

export const ordenCompraIdSchema = z.object({ params: z.object({ id }) });

const itemOrdenCompraSchema = z.object({
  producto_id: z.number().int().positive('El producto es requerido'),
  cantidad_solicitada: z.number().positive('La cantidad solicitada debe ser mayor a 0').max(99999999),
  precio_unitario: z.number().min(0, 'El precio unitario no puede ser negativo').default(0),
  observaciones: z.string().trim().max(500).nullable().optional(),
});

export const crearOrdenCompraSchema = z.object({
  body: z.object({
    sede_id: z.number().int().positive('La sede es requerida').nullable().optional(),
    proveedor_id: z.number().int().positive('El proveedor es requerido'),
    almacen_destino_id: z.number().int().positive().nullable().optional(),
    fecha_emision: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha YYYY-MM-DD').default(() => new Date().toISOString().slice(0, 10)),
    fecha_entrega_esperada: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha YYYY-MM-DD').nullable().optional(),
    moneda: z.enum(['PEN', 'USD']).default('PEN'),
    condicion_pago: z.string().trim().max(50).default('CONTADO'),
    observaciones: z.string().trim().max(1000).nullable().optional(),
    items: z.array(itemOrdenCompraSchema).min(1, 'Debe incluir al menos un producto en la orden'),
  }),
});

export const anularOrdenCompraSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe ingresar un motivo de anulación detallado').max(500),
  }),
});

export const listarOrdenesCompraSchema = z.object({
  query: z.object({
    sede_id: zMultiNumber(),
    proveedor_id: zMultiNumber(),
    almacen_destino_id: zMultiNumber(),
    estado: zMultiString(),
    search: z.string().trim().optional(),
    fecha_desde: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fecha_hasta: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(20),
  }),
});

export type CrearOrdenCompraInput = z.infer<typeof crearOrdenCompraSchema>['body'];
export type AnularOrdenCompraInput = z.infer<typeof anularOrdenCompraSchema>['body'];
export type ListarOrdenesCompraQuery = z.infer<typeof listarOrdenesCompraSchema>['query'];
