export interface Tarifario {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTarifarioInput {
  nombre: string;
  descripcion?: string;
}

export interface UpdateTarifarioInput extends Partial<CreateTarifarioInput> {
  activo?: boolean;
}

export interface TarifarioPrecio {
  id: number;
  tarifario_id: number;
  analisis_id: number;
  precio: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTarifarioPrecioInput {
  tarifario_id: number;
  analisis_id: number;
  precio: number;
}

export interface UpdateTarifarioPrecioInput {
  precio: number;
}

export interface TarifarioWithPrecios extends Tarifario {
  precios: Array<{
    id: number;
    analisis_id: number;
    analisis_nombre: string;
    precio: number;
  }>;
}
