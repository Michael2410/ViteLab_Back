export interface Convenio {
  id: number;
  nombre_empresa: string;
  ruc: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  tarifario_id?: number;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateConvenioInput {
  nombre_empresa: string;
  ruc: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  tarifario_id?: number;
}

export interface UpdateConvenioInput extends Partial<CreateConvenioInput> {
  activo?: boolean;
}

export interface ConvenioWithTarifario extends Convenio {
  tarifario?: {
    id: number;
    nombre: string;
  };
}
