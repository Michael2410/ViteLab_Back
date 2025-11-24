export interface TipoCliente {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTipoClienteInput {
  nombre: string;
  descripcion?: string;
}

export interface UpdateTipoClienteInput extends Partial<CreateTipoClienteInput> {
  activo?: boolean;
}
