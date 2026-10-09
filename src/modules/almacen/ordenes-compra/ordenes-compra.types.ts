import type {
  almacenOrdenesCompra,
  almacenOrdenCompraDetalle,
} from '../../../db';

export type AlmacenOrdenCompra = typeof almacenOrdenesCompra.$inferSelect;
export type AlmacenOrdenCompraDetalle = typeof almacenOrdenCompraDetalle.$inferSelect;

export interface AlmacenOrdenCompraCompleta extends AlmacenOrdenCompra {
  sede_nombre?: string | null;
  proveedor_razon_social?: string | null;
  proveedor_ruc?: string | null;
  proveedor_direccion?: string | null;
  proveedor_telefono?: string | null;
  proveedor_email?: string | null;
  proveedor_contacto?: string | null;
  almacen_destino_nombre?: string | null;
  usuario_registro_nombre?: string | null;
  usuario_anulacion_nombre?: string | null;
  total_items?: number;
  items?: Array<
    AlmacenOrdenCompraDetalle & {
      producto_codigo?: string | null;
      producto_nombre?: string | null;
      unidad_medida_codigo?: string | null;
      unidad_medida_nombre?: string | null;
      saldo_pendiente?: number;
    }
  >;
  ingresos_relacionados?: Array<{
    id: number;
    numero: string;
    fecha_ingreso: string;
    tipo_documento: string;
    numero_documento?: string | null;
    estado: string;
  }>;
}
