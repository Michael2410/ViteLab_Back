export interface Componente {
  id: number;
  nombre: string;
  valores_referenciales: string[];
  unidad_medida?: string;
  area_id?: number;
  metodo_id?: number;
  valor_alerta_min?: number | null;
  valor_alerta_max?: number | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateComponenteInput {
  nombre: string;
  valores_referenciales?: string[];
  unidad_medida?: string;
  area_id?: number;
  metodo_id?: number;
  muestras_ids?: number[];
  valor_alerta_min?: number | null;
  valor_alerta_max?: number | null;
}

export interface UpdateComponenteInput extends Partial<CreateComponenteInput> {
  activo?: boolean;
}

export interface ComponenteWithRelations extends Componente {
  area_nombre?: string;
  metodo_nombre?: string;
  muestras_ids?: number[];
  muestras?: Array<{id: number; nombre: string}>;
}
