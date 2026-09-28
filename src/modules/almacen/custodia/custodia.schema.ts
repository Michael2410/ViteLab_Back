import { z } from 'zod';

export const listarCustodiaSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(500).default(50),
    personal_id: z.coerce.number().int().positive().optional(),
    almacen_id: z.coerce.number().int().positive().optional(),
    search: z.string().optional(),
    solo_con_stock: z.coerce.boolean().default(true),
  }),
});

export type ListarCustodiaQuery = z.infer<typeof listarCustodiaSchema>['query'];
