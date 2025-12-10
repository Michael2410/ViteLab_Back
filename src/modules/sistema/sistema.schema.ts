import { z } from 'zod';

export const updateConfiguracionSchema = z.object({
  body: z.object({
    empresa_nombre: z.string().min(1).max(200).optional(),
    empresa_razon_social: z.string().max(200).optional().nullable(),
    empresa_ruc: z.string().max(20).optional().nullable(),
    empresa_direccion: z.string().max(300).optional().nullable(),
    empresa_telefono: z.string().max(50).optional().nullable(),
    empresa_email: z.union([z.string().email().max(100), z.literal(''), z.null()]).optional(),
    empresa_web: z.union([z.string().url().max(150), z.literal(''), z.null()]).optional(),
    logo_principal: z.string().max(255).optional().nullable(),
    logo_secundario: z.string().max(255).optional().nullable(),
    encabezado_reporte: z.string().optional().nullable(),
    pie_reporte: z.string().optional().nullable(),
    moneda: z.string().max(10).optional(),
    igv_porcentaje: z.number().min(0).max(100).optional(),
  }),
});

export type UpdateConfiguracionSchema = z.infer<typeof updateConfiguracionSchema>;
