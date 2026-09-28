import { z } from 'zod';

const id = z.coerce.number().int().positive('ID inválido');

export const maestroIdSchema = z.object({ params: z.object({ id }) });

// 1. UNIDADES DE MEDIDA
const unidadBody = z.object({
  codigo: z.string().trim().min(1, 'El código es requerido').max(20),
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(50),
  permite_decimales: z.boolean().optional(),
});
export const crearUnidadSchema = z.object({ body: unidadBody });
export const actualizarUnidadSchema = z.object({
  params: z.object({ id }),
  body: unidadBody.partial().extend({ activo: z.boolean().optional() }),
});

// 2. CATEGORÍAS
const categoriaBody = z.object({
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  descripcion: z.string().trim().max(500).nullable().optional(),
});
export const crearCategoriaSchema = z.object({ body: categoriaBody });
export const actualizarCategoriaSchema = z.object({
  params: z.object({ id }),
  body: categoriaBody.partial().extend({ activo: z.boolean().optional() }),
});

// 3. ALMACENES
const almacenBody = z.object({
  sede_id: z.number().int().positive('La sede es requerida'),
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  descripcion: z.string().trim().max(500).nullable().optional(),
  es_principal: z.boolean().optional(),
  responsable_usuario_id: z.number().int().positive().nullable().optional(),
});
export const listarAlmacenesSchema = z.object({
  query: z.object({
    sede_id: z.coerce.number().int().positive().optional(),
    activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  }),
});
export const crearAlmacenSchema = z.object({ body: almacenBody });
export const actualizarAlmacenSchema = z.object({
  params: z.object({ id }),
  body: almacenBody.partial().extend({ activo: z.boolean().optional() }),
});

// 4. UBICACIONES
const ubicacionBody = z.object({
  almacen_id: z.number().int().positive('El almacén es requerido'),
  codigo: z.string().trim().min(1, 'El código es requerido').max(30),
  nombre: z.string().trim().min(1, 'El nombre es requerido').max(100),
  tipo: z.string().trim().max(20).optional(),
  temp_min: z.number().min(-90).max(60).nullable().optional(),
  temp_max: z.number().min(-90).max(60).nullable().optional(),
});
export const listarUbicacionesSchema = z.object({
  query: z.object({
    almacen_id: z.coerce.number().int().positive().optional(),
    activo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  }),
});
export const crearUbicacionSchema = z.object({ body: ubicacionBody });
export const actualizarUbicacionSchema = z.object({
  params: z.object({ id }),
  body: ubicacionBody.partial().extend({ activo: z.boolean().optional() }),
});

export type UnidadMedidaInput = z.infer<typeof crearUnidadSchema>['body'];
export type CategoriaInput = z.infer<typeof crearCategoriaSchema>['body'];
export type AlmacenInput = z.infer<typeof crearAlmacenSchema>['body'];
export type UbicacionInput = z.infer<typeof crearUbicacionSchema>['body'];
export type ListarAlmacenesQuery = z.infer<typeof listarAlmacenesSchema>['query'];
export type ListarUbicacionesQuery = z.infer<typeof listarUbicacionesSchema>['query'];
