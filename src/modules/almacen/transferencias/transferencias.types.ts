export interface ItemTransferenciaDetalle {
  id: number;
  transferencia_id: number;
  producto_id: number;
  lote_id: number;
  cantidad_enviada: number;
  cantidad_recibida: number | null;
  motivo_diferencia: string | null;
  // Joins
  producto_codigo: string | null;
  producto_nombre: string;
  unidad_medida_codigo: string;
  unidad_medida_nombre: string;
  numero_lote: string | null;
  fecha_vencimiento: string | null;
}

export interface AlmacenTransferenciaCompleta {
  id: number;
  numero: string;
  almacen_origen_id: number;
  almacen_destino_id: number;
  estado: string;
  usuario_envio_id: number;
  fecha_envio: string;
  usuario_recepcion_id: number | null;
  fecha_recepcion: string | null;
  motivo_anulacion: string | null;
  usuario_anulacion_id: number | null;
  fecha_anulacion: string | null;
  observaciones: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  almacen_origen_nombre: string;
  sede_origen_id: number;
  sede_origen_nombre?: string;
  almacen_destino_nombre: string;
  sede_destino_id: number;
  sede_destino_nombre?: string;
  usuario_envio_nombre?: string | null;
  usuario_recepcion_nombre?: string | null;
  items?: ItemTransferenciaDetalle[];
}
