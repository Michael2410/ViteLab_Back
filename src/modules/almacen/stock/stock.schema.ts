import { z } from 'zod';

export const listarStockQuerySchema = z.object({
  almacen_id: z.coerce.number().int().positive().optional(),
  sede_id: z.coerce.number().int().positive().optional(),
  producto_id: z.coerce.number().int().positive().optional(),
  categoria_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  con_saldo: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(true),
  desglosar_lote: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

export const listarKardexQuerySchema = z.object({
  almacen_id: z.coerce.number().int().positive().optional(),
  producto_id: z.coerce.number().int().positive().optional(),
  lote_id: z.coerce.number().int().positive().optional(),
  tipo: z.string().trim().optional(),
  fecha_desde: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_hasta: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

export const stockParamsSchema = z.object({
  query: listarStockQuerySchema,
});

export const kardexParamsSchema = z.object({
  query: listarKardexQuerySchema,
});

export type ListarStockQuery = z.infer<typeof listarStockQuerySchema>;
export type ListarKardexQuery = z.infer<typeof listarKardexQuerySchema>;
