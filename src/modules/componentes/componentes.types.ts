export interface Componente {
  id: number;
  analisis_id: number;
  nombre: string;
  valor_referencial: string;
  area_id?: number;
  metodo_id?: number;
  orden: number;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateComponenteInput {
  analisis_id: number;
  nombre: string;
  valor_referencial: string;
  area_id?: number;
  metodo_id?: number;
  orden?: number;
}

export interface UpdateComponenteInput extends Partial<CreateComponenteInput> {
  activo?: boolean;
}

export interface ComponenteWithRelations extends Componente {
  analisis_nombre: string;
  area_nombre?: string;
  metodo_nombre?: string;
}
