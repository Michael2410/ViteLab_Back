import type {
  almacenIngresos,
  almacenIngresoDetalle,
} from '../../../db';

export type AlmacenIngreso = typeof almacenIngresos.$inferSelect;
export type AlmacenIngresoDetalle = typeof almacenIngresoDetalle.$inferSelect;

export interface AlmacenIngresoCompleto extends AlmacenIngreso {
  almacen_nombre?: string | null;
  sede_id?: number | null;
  sede_nombre?: string | null;
  proveedor_razon_social?: string | null;
  proveedor_ruc?: string | null;
  usuario_registro_nombre?: string | null;
  usuario_anulacion_nombre?: string | null;
  correlativo?: string;
  total_items?: number;
  monto_total?: number | string;
  items?: Array<
    AlmacenIngresoDetalle & {
      producto_codigo?: string | null;
      producto_nombre?: string | null;
      unidad_medida_codigo?: string | null;
      numero_lote?: string | null;
      marca?: string | null;
      fecha_vencimiento?: string | null;
      ubicacion_codigo?: string | null;
    }
  >;
}
