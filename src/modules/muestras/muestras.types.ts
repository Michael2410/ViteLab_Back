export interface Muestra {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMuestraInput {
  nombre: string;
  descripcion?: string;
}

export interface UpdateMuestraInput extends Partial<CreateMuestraInput> {
  activo?: boolean;
}
