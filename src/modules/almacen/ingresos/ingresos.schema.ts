import { z } from 'zod';
import { zMultiNumber, zMultiString } from '../shared/almacen.filters';

const id = z.coerce.number().int().positive('ID inválido');

export const ingresoIdSchema = z.object({ params: z.object({ id }) });

const lineaIngresoSchema = z.object({
  producto_id: z.number().int().positive('El producto es requerido'),
  orden_compra_detalle_id: z.number().int().positive().nullable().optional(),
  numero_lote: z.string().trim().max(100).nullable().optional(),
  marca: z.string().trim().max(100).nullable().optional(),
  fecha_vencimiento: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha YYYY-MM-DD').nullable().optional(),
  fecha_fabricacion: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato fecha YYYY-MM-DD').nullable().optional(),
  ubicacion_id: z.number().int().positive().nullable().optional(),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0').max(99999999),
  costo_unitario: z.number().min(0, 'El costo unitario no puede ser negativo').default(0),
});

export const crearIngresoSchema = z.object({
  body: z.object({
    almacen_id: z.number().int().positive('El almacén es requerido'),
    proveedor_id: z.number().int().positive().nullable().optional(),
    orden_compra_id: z.number().int().positive().nullable().optional(),
    tipo_documento: z.enum([
      'FACTURA',
      'BOLETA',
      'GUIA_REMISION',
      'DONACION',
      'INVENTARIO_INICIAL',
      'OTRO',
    ]).default('FACTURA'),
    serie_documento: z.string().trim().max(20).nullable().optional(),
    numero_documento: z.string().trim().max(30).nullable().optional(),
    fecha_documento: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    fecha_ingreso: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
    moneda: z.enum(['PEN', 'USD']).default('PEN'),
    observaciones: z.string().trim().max(1000).nullable().optional(),
    items: z.array(lineaIngresoSchema).min(1, 'Debe incluir al menos un producto'),
  }),
});

export const anularIngresoSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe ingresar un motivo de anulación detallado').max(500),
  }),
});

export const listarIngresosSchema = z.object({
  query: z.object({
    almacen_id: zMultiNumber(),
    proveedor_id: zMultiNumber(),
    estado: zMultiString(),
    search: z.string().trim().optional(),
    fecha_desde: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fecha_hasta: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(500).default(20),
  }),
});

export type CrearIngresoInput = z.infer<typeof crearIngresoSchema>['body'];
export type AnularIngresoInput = z.infer<typeof anularIngresoSchema>['body'];
export type ListarIngresosQuery = z.infer<typeof listarIngresosSchema>['query'];
