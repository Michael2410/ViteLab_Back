import { z } from 'zod';

// ============================================
// SCHEMAS PARA CREAR RESULTADOS
// ============================================

export const createResultadoSchema = z.object({
  body: z.object({
    orden_analisis_id: z.number({
      message: 'El ID de orden-análisis es requerido',
    }).int().positive(),
    componente_id: z.number({
      message: 'El ID del componente es requerido',
    }).int().positive(),
    valor: z.string({
      message: 'El valor del resultado es requerido',
    }).min(1, 'El valor no puede estar vacío'),
    unidad_medida: z.string().optional(),
    observaciones: z.string().max(500, 'Las observaciones no pueden exceder 500 caracteres').optional(),
  }),
});

export const bulkResultadosSchema = z.object({
  body: z.object({
    orden_id: z.number({
      message: 'El ID de la orden es requerido',
    }).int().positive(),
    resultados: z.array(
      z.object({
        orden_analisis_id: z.number().int().positive(),
        componente_id: z.number().int().positive(),
        valor: z.string().min(1),
        unidad_medida: z.string().optional(),
        observaciones: z.string().max(500).optional(),
      })
    ).min(1, 'Debe ingresar al menos un resultado'),
  }),
});

// ============================================
// SCHEMAS PARA ACTUALIZAR RESULTADOS
// ============================================

export const updateResultadoSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    valor: z.string().min(1, 'El valor no puede estar vacío').optional(),
    unidad_medida: z.string().optional(),
    observaciones: z.string().max(500).optional(),
  }),
});

// ============================================
// SCHEMAS PARA CONSULTAS
// ============================================

export const getResultadoByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const getResultadosByOrdenSchema = z.object({
  params: z.object({
    ordenId: z.string().regex(/^\d+$/, 'ID de orden debe ser un número'),
  }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const getResultadosFilterSchema = z.object({
  query: z.object({
    orden_id: z.string().regex(/^\d+$/).optional(),
    orden_analisis_id: z.string().regex(/^\d+$/).optional(),
    componente_id: z.string().regex(/^\d+$/).optional(),
  }),
});

export const deleteResultadoSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});
