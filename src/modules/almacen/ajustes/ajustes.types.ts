export interface ItemAjusteDetalle {
  id: number;
  ajuste_id: number;
  producto_id: number;
  lote_id: number;
  cantidad: number;
  sentido: 'ENTRADA' | 'SALIDA';
  costo_unitario: number | null;
  observacion: string | null;
  // Joins
  producto_codigo: string | null;
  producto_nombre: string;
  unidad_medida_codigo: string;
  unidad_medida_nombre: string;
  numero_lote: string | null;
  fecha_vencimiento: string | null;
}

export interface AlmacenAjusteCompleto {
  id: number;
  numero: string;
  almacen_id: number;
  tipo: string;
  motivo: string | null;
  estado: string;
  usuario_registro_id: number;
  usuario_aprobacion_id: number | null;
  fecha_aprobacion: string | null;
  motivo_rechazo: string | null;
  observaciones: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  almacen_nombre: string;
  sede_id: number;
  sede_nombre?: string;
  usuario_registro_nombre?: string | null;
  usuario_aprobacion_nombre?: string | null;
  items?: ItemAjusteDetalle[];
}
