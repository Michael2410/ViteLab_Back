export interface Metodo {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMetodoInput {
  nombre: string;
  descripcion?: string;
}

export interface UpdateMetodoInput extends Partial<CreateMetodoInput> {
  activo?: boolean;
}
