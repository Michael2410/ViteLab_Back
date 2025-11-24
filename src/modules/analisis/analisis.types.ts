export interface Analisis {
  id: number;
  nombre: string;
  descripcion: string | null;
  sinonimia: string[];
  componentes_ids: number[];
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAnalisisInput {
  nombre: string;
  descripcion?: string | null;
  sinonimia?: string[];
  componentes_ids?: number[];
}

export interface UpdateAnalisisInput extends Partial<CreateAnalisisInput> {
  activo?: boolean;
}

export interface AnalisisWithComponents extends Analisis {
  componentes: Array<{
    id: number;
    nombre: string;
    valor_referencial: string;
    area_nombre: string;
    metodo_nombre: string;
  }>;
}
