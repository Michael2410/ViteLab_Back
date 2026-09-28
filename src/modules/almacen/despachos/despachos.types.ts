export interface AlmacenDespachoItem {
  id: number;
  despacho_id: number;
  pedido_detalle_id?: number | null;
  producto_id: number;
  lote_id: number;
  cantidad: number;
  producto_codigo?: string | null;
  producto_nombre?: string;
  unidad_medida_codigo?: string | null;
  numero_lote?: string | null;
  marca?: string | null;
  fecha_vencimiento?: string | null;
}

export interface AlmacenDespachoCompleto {
  id: number;
  numero: string;
  almacen_id: number;
  receptor_personal_id: number;
  area_id?: number | null;
  pedido_id?: number | null;
  fecha: string;
  observaciones?: string | null;
  estado: string;
  motivo_anulacion?: string | null;
  usuario_registro_id: number;
  usuario_anulacion_id?: number | null;
  fecha_anulacion?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  almacen_nombre?: string;
  sede_id: number;
  receptor_nombres?: string;
  receptor_apellidos?: string;
  receptor_documento?: string | null;
  area_nombre?: string | null;
  usuario_registro_nombre?: string | null;
  items?: AlmacenDespachoItem[];
}
