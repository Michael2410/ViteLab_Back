import { z } from 'zod';

// PACIENTE
export const createPacienteSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos').regex(/^\d+$/, 'El DNI debe contener solo números'),
  nombres: z.string().min(1, 'Los nombres son requeridos').max(100),
  apellidos: z.string().min(1, 'Los apellidos son requeridos').max(100),
  fecha_nacimiento: z.string().refine((date) => !isNaN(Date.parse(date)), 'Fecha inválida'),
  sexo: z.enum(['M', 'F'], { message: 'El sexo debe ser M o F' }),
  telefono: z.string().max(20).optional(),
  email: z.string().email('Email inválido').optional(),
  direccion: z.string().max(255).optional(),
});

// ORDEN
export const createOrdenSchema = z.object({
  body: z.object({
    paciente: createPacienteSchema,
    sede_id: z.number().int().positive('La sede es requerida'),
    tipo_cliente_id: z.number().int().positive('El tipo de cliente es requerido'),
    convenio_id: z.number().int().positive().optional(),
    analisis_ids: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un análisis'),
    observaciones: z.string().max(500).optional(),
  }),
});

export const updateOrdenSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    sede_id: z.number().int().positive().optional(),
    tipo_cliente_id: z.number().int().positive().optional(),
    convenio_id: z.number().int().positive().optional(),
    observaciones: z.string().max(500).optional(),
  }),
});

export const getOrdenByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const deleteOrdenSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
});

export const updateEstadoOrdenSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número'),
  }),
  body: z.object({
    estado: z.enum(['REGISTRADA', 'CON_RESULTADOS', 'APROBADA']),
  }),
});

export const getOrdenesByFiltersSchema = z.object({
  query: z.object({
    estado: z.enum(['REGISTRADA', 'CON_RESULTADOS', 'APROBADA']).optional(),
    sede_id: z.string().regex(/^\d+$/).optional(),
    fecha_desde: z.string().optional(),
    fecha_hasta: z.string().optional(),
    paciente_dni: z.string().optional(),
    numero_orden: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('20'),
  }).optional(),
});

export const consultarDniSchema = z.object({
  params: z.object({
    dni: z.string().length(8, 'El DNI debe tener 8 dígitos').regex(/^\d+$/, 'El DNI debe contener solo números'),
  }),
});
