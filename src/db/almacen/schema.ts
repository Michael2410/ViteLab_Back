// ESCRITO A MANO. Fuente de verdad: "update BD/024+ y 026+". No regenerar con drizzle-kit.
import { sql } from 'drizzle-orm';
import {
  pgSchema,
  serial,
  bigserial,
  integer,
  varchar,
  text,
  boolean,
  numeric,
  timestamp,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
// Importar directo de drizzle-generated (NO de '../index') para evitar imports circulares
import { sedes, usuarios, areas, personal } from '../drizzle-generated/schema';

export const almacenSchema = pgSchema('almacen');

const cantidad = (name: string) => numeric(name, { precision: 14, scale: 3, mode: 'number' });
const costo = (name: string) => numeric(name, { precision: 14, scale: 4, mode: 'number' });

const auditoria = {
  created_at: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
};

// 1. UNIDADES DE MEDIDA
export const almacenUnidadesMedida = almacenSchema.table('unidades_medida', {
  id: serial().primaryKey(),
  codigo: varchar({ length: 20 }).notNull(),
  nombre: varchar({ length: 50 }).notNull(),
  permite_decimales: boolean('permite_decimales').default(false).notNull(),
  activo: boolean().default(true).notNull(),
  ...auditoria,
});

// 2. CATEGORÍAS
export const almacenCategorias = almacenSchema.table('categorias', {
  id: serial().primaryKey(),
  nombre: varchar({ length: 100 }).notNull(),
  descripcion: text(),
  activo: boolean().default(true).notNull(),
  ...auditoria,
});

// 3. PROVEEDORES
export const almacenProveedores = almacenSchema.table('proveedores', {
  id: serial().primaryKey(),
  ruc: varchar({ length: 11 }),
  razon_social: varchar('razon_social', { length: 200 }).notNull(),
  nombre_comercial: varchar('nombre_comercial', { length: 200 }),
  direccion: text(),
  contacto: varchar({ length: 150 }),
  telefono: varchar({ length: 30 }),
  email: varchar({ length: 100 }),
  activo: boolean().default(true).notNull(),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 4. ALMACENES (por sede)
export const almacenAlmacenes = almacenSchema.table('almacenes', {
  id: serial().primaryKey(),
  sede_id: integer('sede_id')
    .notNull()
    .references(() => sedes.id),
  nombre: varchar({ length: 100 }).notNull(),
  descripcion: text(),
  es_principal: boolean('es_principal').default(false).notNull(),
  responsable_usuario_id: integer('responsable_usuario_id').references(() => usuarios.id),
  activo: boolean().default(true).notNull(),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 5. UBICACIONES
export const almacenUbicaciones = almacenSchema.table('ubicaciones', {
  id: serial().primaryKey(),
  almacen_id: integer('almacen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  codigo: varchar({ length: 30 }).notNull(),
  nombre: varchar({ length: 100 }).notNull(),
  tipo: varchar({ length: 20 }).default('ESTANTE').notNull(),
  temp_min: numeric('temp_min', { precision: 5, scale: 2, mode: 'number' }),
  temp_max: numeric('temp_max', { precision: 5, scale: 2, mode: 'number' }),
  activo: boolean().default(true).notNull(),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 6. PRODUCTOS
export const almacenProductos = almacenSchema.table('productos', {
  id: serial().primaryKey(),
  codigo: varchar({ length: 50 }),
  nombre: varchar({ length: 200 }).notNull(),
  descripcion: text(),
  categoria_id: integer('categoria_id').references(() => almacenCategorias.id),
  unidad_medida_id: integer('unidad_medida_id')
    .notNull()
    .references(() => almacenUnidadesMedida.id),
  area_id: integer('area_id').references(() => areas.id),
  stock_minimo: cantidad('stock_minimo').default(0).notNull(),
  controla_lote: boolean('controla_lote').default(false).notNull(),
  controla_vencimiento: boolean('controla_vencimiento').default(false).notNull(),
  requiere_cadena_frio: boolean('requiere_cadena_frio').default(false).notNull(),
  temp_min: numeric('temp_min', { precision: 5, scale: 2, mode: 'number' }),
  temp_max: numeric('temp_max', { precision: 5, scale: 2, mode: 'number' }),
  dias_alerta_vencimiento: integer('dias_alerta_vencimiento').default(30).notNull(),
  activo: boolean().default(true).notNull(),
  legacy_id: varchar('legacy_id', { length: 50 }),
  usuario_registro_id: integer('usuario_registro_id').references(() => usuarios.id),
  ...auditoria,
});

// 7. LOTES
export const almacenLotes = almacenSchema.table('lotes', {
  id: serial().primaryKey(),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  numero_lote: varchar('numero_lote', { length: 100 }),
  marca: varchar({ length: 100 }),
  fecha_vencimiento: date('fecha_vencimiento'),
  fecha_fabricacion: date('fecha_fabricacion'),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 8. CORRELATIVOS
export const almacenCorrelativos = almacenSchema.table(
  'correlativos',
  {
    tipo: varchar({ length: 5 }).notNull(),
    sede_id: integer('sede_id')
      .notNull()
      .references(() => sedes.id),
    anio: integer().notNull(),
    ultimo: integer().default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tipo, table.sede_id, table.anio] }),
  ]
);

// 9. INGRESOS
export const almacenIngresos = almacenSchema.table('ingresos', {
  id: serial().primaryKey(),
  numero: varchar({ length: 30 }).notNull().unique(),
  almacen_id: integer('almacen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  proveedor_id: integer('proveedor_id').references(() => almacenProveedores.id),
  tipo_documento: varchar('tipo_documento', { length: 20 }).default('FACTURA').notNull(),
  serie_documento: varchar('serie_documento', { length: 20 }),
  numero_documento: varchar('numero_documento', { length: 30 }),
  fecha_documento: date('fecha_documento'),
  fecha_ingreso: date('fecha_ingreso').default(sql`CURRENT_DATE`).notNull(),
  moneda: varchar({ length: 3 }).default('PEN').notNull(),
  observaciones: text(),
  adjunto_url: text('adjunto_url'),
  estado: varchar({ length: 20 }).default('REGISTRADO').notNull(),
  motivo_anulacion: text('motivo_anulacion'),
  usuario_registro_id: integer('usuario_registro_id')
    .notNull()
    .references(() => usuarios.id),
  usuario_anulacion_id: integer('usuario_anulacion_id').references(() => usuarios.id),
  fecha_anulacion: timestamp('fecha_anulacion', { mode: 'string' }),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 10. INGRESO DETALLE
export const almacenIngresoDetalle = almacenSchema.table('ingreso_detalle', {
  id: serial().primaryKey(),
  ingreso_id: integer('ingreso_id')
    .notNull()
    .references(() => almacenIngresos.id, { onDelete: 'cascade' }),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  ubicacion_id: integer('ubicacion_id').references(() => almacenUbicaciones.id),
  cantidad: cantidad('cantidad').notNull(),
  costo_unitario: costo('costo_unitario').default(0).notNull(),
  legacy_id: varchar('legacy_id', { length: 50 }),
  created_at: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

// 11. STOCK (saldo consolidado por almacén y lote)
export const almacenStock = almacenSchema.table('stock', {
  id: serial().primaryKey(),
  almacen_id: integer('almacen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad: cantidad('cantidad').default(0).notNull(),
  updated_at: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

// 12. MOVIMIENTOS (kardex)
export const almacenMovimientos = almacenSchema.table('movimientos', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  tipo: varchar({ length: 25 }).notNull(),
  fecha: timestamp('fecha', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  sede_id: integer('sede_id')
    .notNull()
    .references(() => sedes.id),
  almacen_id: integer('almacen_id').references(() => almacenAlmacenes.id),
  personal_id: integer('personal_id').references(() => personal.id),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad: cantidad('cantidad').notNull(),
  costo_unitario: costo('costo_unitario'),
  documento_tipo: varchar('documento_tipo', { length: 20 }).notNull(),
  documento_id: integer('documento_id').notNull(),
  documento_detalle_id: integer('documento_detalle_id'),
  anula_movimiento_id: integer('anula_movimiento_id'),
  observacion: text(),
  usuario_id: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  created_at: timestamp('created_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

// 13. STOCK CUSTODIA (saldo personal por almacén de origen y lote)
export const almacenStockCustodia = almacenSchema.table('stock_custodia', {
  id: serial().primaryKey(),
  personal_id: integer('personal_id')
    .notNull()
    .references(() => personal.id),
  almacen_origen_id: integer('almacen_origen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad: cantidad('cantidad').default(0).notNull(),
  updated_at: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

// 14. PEDIDOS
export const almacenPedidos = almacenSchema.table('pedidos', {
  id: serial().primaryKey(),
  numero: varchar({ length: 30 }).notNull().unique(),
  almacen_id: integer('almacen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  solicitante_personal_id: integer('solicitante_personal_id')
    .notNull()
    .references(() => personal.id),
  area_id: integer('area_id').references(() => areas.id),
  estado: varchar({ length: 20 }).default('PENDIENTE').notNull(),
  observaciones: text(),
  motivo_rechazo: text('motivo_rechazo'),
  motivo_anulacion: text('motivo_anulacion'),
  motivo_cierre: text('motivo_cierre'),
  usuario_registro_id: integer('usuario_registro_id')
    .notNull()
    .references(() => usuarios.id),
  usuario_aprobacion_id: integer('usuario_aprobacion_id').references(() => usuarios.id),
  fecha_aprobacion: timestamp('fecha_aprobacion', { mode: 'string' }),
  fecha_atencion: timestamp('fecha_atencion', { mode: 'string' }),
  usuario_anulacion_id: integer('usuario_anulacion_id').references(() => usuarios.id),
  fecha_anulacion: timestamp('fecha_anulacion', { mode: 'string' }),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 15. PEDIDO DETALLE
export const almacenPedidoDetalle = almacenSchema.table('pedido_detalle', {
  id: serial().primaryKey(),
  pedido_id: integer('pedido_id')
    .notNull()
    .references(() => almacenPedidos.id, { onDelete: 'cascade' }),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  cantidad_solicitada: cantidad('cantidad_solicitada').notNull(),
  cantidad_aprobada: cantidad('cantidad_aprobada'),
  cantidad_atendida: cantidad('cantidad_atendida').default(0).notNull(),
  observacion: text(),
});

// 16. DESPACHOS
export const almacenDespachos = almacenSchema.table('despachos', {
  id: serial().primaryKey(),
  numero: varchar({ length: 30 }).notNull().unique(),
  almacen_id: integer('almacen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  receptor_personal_id: integer('receptor_personal_id')
    .notNull()
    .references(() => personal.id),
  area_id: integer('area_id').references(() => areas.id),
  pedido_id: integer('pedido_id').references(() => almacenPedidos.id),
  fecha: timestamp('fecha', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  observaciones: text(),
  estado: varchar({ length: 20 }).default('REGISTRADO').notNull(),
  motivo_anulacion: text('motivo_anulacion'),
  usuario_registro_id: integer('usuario_registro_id')
    .notNull()
    .references(() => usuarios.id),
  usuario_anulacion_id: integer('usuario_anulacion_id').references(() => usuarios.id),
  fecha_anulacion: timestamp('fecha_anulacion', { mode: 'string' }),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 17. DESPACHO DETALLE
export const almacenDespachoDetalle = almacenSchema.table('despacho_detalle', {
  id: serial().primaryKey(),
  despacho_id: integer('despacho_id')
    .notNull()
    .references(() => almacenDespachos.id, { onDelete: 'cascade' }),
  pedido_detalle_id: integer('pedido_detalle_id').references(() => almacenPedidoDetalle.id),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad: cantidad('cantidad').notNull(),
});

// 18. CONSUMOS
export const almacenConsumos = almacenSchema.table('consumos', {
  id: serial().primaryKey(),
  numero: varchar({ length: 30 }).notNull().unique(),
  sede_id: integer('sede_id')
    .notNull()
    .references(() => sedes.id),
  personal_id: integer('personal_id')
    .notNull()
    .references(() => personal.id),
  area_id: integer('area_id').references(() => areas.id),
  fecha: timestamp('fecha', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  observaciones: text(),
  estado: varchar({ length: 20 }).default('REGISTRADO').notNull(),
  motivo_anulacion: text('motivo_anulacion'),
  usuario_registro_id: integer('usuario_registro_id')
    .notNull()
    .references(() => usuarios.id),
  usuario_anulacion_id: integer('usuario_anulacion_id').references(() => usuarios.id),
  fecha_anulacion: timestamp('fecha_anulacion', { mode: 'string' }),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 19. CONSUMO DETALLE
export const almacenConsumoDetalle = almacenSchema.table('consumo_detalle', {
  id: serial().primaryKey(),
  consumo_id: integer('consumo_id')
    .notNull()
    .references(() => almacenConsumos.id, { onDelete: 'cascade' }),
  almacen_origen_id: integer('almacen_origen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad: cantidad('cantidad').notNull(),
  observacion: text(),
});

// 20. DEVOLUCIONES
export const almacenDevoluciones = almacenSchema.table('devoluciones', {
  id: serial().primaryKey(),
  numero: varchar({ length: 30 }).notNull().unique(),
  almacen_id: integer('almacen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  personal_id: integer('personal_id')
    .notNull()
    .references(() => personal.id),
  fecha: timestamp('fecha', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  observaciones: text(),
  estado: varchar({ length: 20 }).default('REGISTRADO').notNull(),
  motivo_anulacion: text('motivo_anulacion'),
  usuario_registro_id: integer('usuario_registro_id')
    .notNull()
    .references(() => usuarios.id),
  usuario_anulacion_id: integer('usuario_anulacion_id').references(() => usuarios.id),
  fecha_anulacion: timestamp('fecha_anulacion', { mode: 'string' }),
  legacy_id: varchar('legacy_id', { length: 50 }),
  ...auditoria,
});

// 21. DEVOLUCION DETALLE
export const almacenDevolucionDetalle = almacenSchema.table('devolucion_detalle', {
  id: serial().primaryKey(),
  devolucion_id: integer('devolucion_id')
    .notNull()
    .references(() => almacenDevoluciones.id, { onDelete: 'cascade' }),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad: cantidad('cantidad').notNull(),
  observacion: text(),
});

// 22. TRANSFERENCIAS
export const almacenTransferencias = almacenSchema.table('transferencias', {
  id: serial().primaryKey(),
  numero: varchar({ length: 30 }).notNull().unique(),
  almacen_origen_id: integer('almacen_origen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  almacen_destino_id: integer('almacen_destino_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  estado: varchar({ length: 20 }).default('EN_TRANSITO').notNull(),
  usuario_envio_id: integer('usuario_envio_id')
    .notNull()
    .references(() => usuarios.id),
  fecha_envio: timestamp('fecha_envio', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  usuario_recepcion_id: integer('usuario_recepcion_id').references(() => usuarios.id),
  fecha_recepcion: timestamp('fecha_recepcion', { mode: 'string' }),
  motivo_anulacion: text('motivo_anulacion'),
  usuario_anulacion_id: integer('usuario_anulacion_id').references(() => usuarios.id),
  fecha_anulacion: timestamp('fecha_anulacion', { mode: 'string' }),
  observaciones: text(),
  ...auditoria,
});

// 23. TRANSFERENCIA DETALLE
export const almacenTransferenciaDetalle = almacenSchema.table('transferencia_detalle', {
  id: serial().primaryKey(),
  transferencia_id: integer('transferencia_id')
    .notNull()
    .references(() => almacenTransferencias.id, { onDelete: 'cascade' }),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad_enviada: cantidad('cantidad_enviada').notNull(),
  cantidad_recibida: cantidad('cantidad_recibida'),
  motivo_diferencia: text('motivo_diferencia'),
});

// 24. AJUSTES
export const almacenAjustes = almacenSchema.table('ajustes', {
  id: serial().primaryKey(),
  numero: varchar({ length: 30 }).notNull().unique(),
  almacen_id: integer('almacen_id')
    .notNull()
    .references(() => almacenAlmacenes.id),
  tipo: varchar({ length: 30 }).notNull(),
  motivo: varchar({ length: 50 }),
  estado: varchar({ length: 20 }).default('PENDIENTE').notNull(),
  usuario_registro_id: integer('usuario_registro_id')
    .notNull()
    .references(() => usuarios.id),
  usuario_aprobacion_id: integer('usuario_aprobacion_id').references(() => usuarios.id),
  fecha_aprobacion: timestamp('fecha_aprobacion', { mode: 'string' }),
  motivo_rechazo: text('motivo_rechazo'),
  observaciones: text(),
  ...auditoria,
});

// 25. AJUSTE DETALLE
export const almacenAjusteDetalle = almacenSchema.table('ajuste_detalle', {
  id: serial().primaryKey(),
  ajuste_id: integer('ajuste_id')
    .notNull()
    .references(() => almacenAjustes.id, { onDelete: 'cascade' }),
  producto_id: integer('producto_id')
    .notNull()
    .references(() => almacenProductos.id),
  lote_id: integer('lote_id')
    .notNull()
    .references(() => almacenLotes.id),
  cantidad: cantidad('cantidad').notNull(),
  sentido: varchar({ length: 10 }).notNull(),
  costo_unitario: costo('costo_unitario').default(0),
  observacion: text(),
});

