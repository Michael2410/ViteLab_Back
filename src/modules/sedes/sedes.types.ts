export interface Sede {
  id: number;
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSedeInput {
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

export interface UpdateSedeInput extends Partial<CreateSedeInput> {
  activo?: boolean;
}
