export interface Area {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAreaInput {
  nombre: string;
  descripcion?: string;
}

export interface UpdateAreaInput extends Partial<CreateAreaInput> {
  activo?: boolean;
}
