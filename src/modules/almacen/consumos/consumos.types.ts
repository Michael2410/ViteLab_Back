export interface ItemConsumoDetalle {
  id: number;
  consumo_id: number;
  almacen_origen_id: number;
  producto_id: number;
  lote_id: number;
  cantidad: number;
  observacion: string | null;
  // Joins
  producto_codigo: string | null;
  producto_nombre: string;
  unidad_medida_codigo: string;
  numero_lote: string | null;
  fecha_vencimiento: string | null;
  almacen_nombre?: string;
}

export interface AlmacenConsumoCompleto {
  id: number;
  numero: string;
  sede_id: number;
  personal_id: number;
  area_id: number | null;
  fecha: string;
  observaciones: string | null;
  estado: string;
  motivo_anulacion: string | null;
  usuario_registro_id: number;
  usuario_anulacion_id: number | null;
  fecha_anulacion: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  sede_nombre?: string;
  personal_nombres?: string;
  personal_apellidos?: string;
  personal_documento?: string | null;
  area_nombre?: string | null;
  usuario_registro_nombre?: string | null;
  items?: ItemConsumoDetalle[];
}

export interface ItemDevolucionDetalle {
  id: number;
  devolucion_id: number;
  producto_id: number;
  lote_id: number;
  cantidad: number;
  observacion: string | null;
  producto_codigo: string | null;
  producto_nombre: string;
  unidad_medida_codigo: string;
  numero_lote: string | null;
}

export interface AlmacenDevolucionCompleta {
  id: number;
  numero: string;
  almacen_id: number;
  personal_id: number;
  fecha: string;
  observaciones: string | null;
  estado: string;
  motivo_anulacion: string | null;
  usuario_registro_id: number;
  usuario_anulacion_id: number | null;
  fecha_anulacion: string | null;
  created_at: string | null;
  updated_at: string | null;
  almacen_nombre?: string;
  sede_id: number;
  personal_nombres?: string;
  personal_apellidos?: string;
  personal_documento?: string | null;
  usuario_registro_nombre?: string | null;
  items?: ItemDevolucionDetalle[];
}
