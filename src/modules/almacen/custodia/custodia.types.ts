export interface ItemCustodia {
  id: number;
  personal_id: number;
  almacen_origen_id: number;
  lote_id: number;
  cantidad: number;
  updated_at: string | null;
  // Joins
  personal_nombres: string;
  personal_apellidos: string;
  personal_documento: string | null;
  almacen_nombre: string;
  sede_id: number;
  producto_id: number;
  producto_codigo: string | null;
  producto_nombre: string;
  unidad_medida_codigo: string;
  unidad_medida_nombre: string;
  numero_lote: string | null;
  fecha_vencimiento: string | null;
  dias_para_vencer: number | null;
  estado_vencimiento: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'SIN_VENCIMIENTO';
}

export interface CustodiaResumen {
  total_items: number;
  total_unidades: number;
  items_por_vencer: number;
  items_vencidos: number;
}
