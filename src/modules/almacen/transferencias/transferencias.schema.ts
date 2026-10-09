import { z } from 'zod';
import { zMultiNumber, zMultiString } from '../shared/almacen.filters';

const id = z.coerce.number().int().positive('ID inválido');

export const transferenciaIdSchema = z.object({ params: z.object({ id }) });

export const itemTransferenciaSchema = z.object({
  producto_id: z.number().int().positive('El producto es requerido'),
  lote_id: z.number().int().positive('El lote es requerido'),
  cantidad_enviada: z.number().positive('La cantidad debe ser mayor a 0'),
});

export const crearTransferenciaSchema = z.object({
  body: z
    .object({
      almacen_origen_id: z.number().int().positive('Almacén origen requerido'),
      almacen_destino_id: z.number().int().positive('Almacén destino requerido'),
      observaciones: z.string().max(1000).optional(),
      items: z.array(itemTransferenciaSchema).min(1, 'Debe incluir al menos un ítem'),
    })
    .refine((data) => data.almacen_origen_id !== data.almacen_destino_id, {
      message: 'El almacén de destino no puede ser igual al de origen',
      path: ['almacen_destino_id'],
    }),
});

export const itemRecepcionSchema = z.object({
  detalle_id: z.number().int().positive(),
  cantidad_recibida: z.number().min(0, 'La cantidad no puede ser negativa'),
  motivo_diferencia: z.string().max(500).optional(),
});

export const recibirTransferenciaSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    items: z.array(itemRecepcionSchema).min(1, 'Debe indicar las cantidades recibidas'),
  }),
});

export const anularTransferenciaSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    motivo: z.string().trim().min(5, 'Debe indicar un motivo de anulación (mínimo 5 caracteres)'),
  }),
});

export const listarTransferenciasSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(10),
    almacen_id: zMultiNumber(),
    almacen_origen_id: zMultiNumber(),
    almacen_destino_id: zMultiNumber(),
    estado: zMultiString(),
    fecha_desde: z.string().optional(),
    fecha_hasta: z.string().optional(),
    search: z.string().optional(),
  }),
});

export type CrearTransferenciaInput = z.infer<typeof crearTransferenciaSchema>['body'];
export type RecibirTransferenciaInput = z.infer<typeof recibirTransferenciaSchema>['body'];
export type AnularTransferenciaInput = z.infer<typeof anularTransferenciaSchema>['body'];
export type ListarTransferenciasQuery = z.infer<typeof listarTransferenciasSchema>['query'];
