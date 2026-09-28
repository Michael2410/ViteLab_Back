export interface ItemPedidoDetalle {
  id: number;
  pedido_id: number;
  producto_id: number;
  cantidad_solicitada: number;
  cantidad_aprobada: number | null;
  cantidad_atendida: number;
  observacion: string | null;
  // Joins
  producto_codigo: string | null;
  producto_nombre: string;
  unidad_medida_codigo: string;
  unidad_medida_nombre: string;
  stock_disponible_almacen?: number | string;
}

export interface AlmacenPedidoCompleto {
  id: number;
  numero: string;
  almacen_id: number;
  solicitante_personal_id: number;
  area_id: number | null;
  estado: string;
  observaciones: string | null;
  motivo_rechazo: string | null;
  motivo_anulacion: string | null;
  motivo_cierre: string | null;
  usuario_registro_id: number;
  usuario_aprobacion_id: number | null;
  fecha_aprobacion: string | null;
  fecha_atencion: string | null;
  usuario_anulacion_id: number | null;
  fecha_anulacion: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  almacen_nombre?: string;
  sede_id: number;
  sede_nombre?: string;
  solicitante_nombres?: string | null;
  solicitante_apellidos?: string | null;
  solicitante_documento?: string | null;
  area_nombre?: string | null;
  usuario_registro_nombre?: string | null;
  usuario_aprobacion_nombre?: string | null;
  items?: ItemPedidoDetalle[];
}
