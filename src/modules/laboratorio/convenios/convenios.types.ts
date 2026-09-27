import type { InferSelectModel } from 'drizzle-orm';
import { convenios } from '../../../db';

export type Convenio = InferSelectModel<typeof convenios>;

export interface CreateConvenioInput {
  nombre_empresa: string;
  ruc: string;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  tarifario_id?: number | null;
  logo_url?: string | null;
}

export interface UpdateConvenioInput extends Partial<CreateConvenioInput> {
  activo?: boolean;
}

export interface ConvenioWithTarifario extends Convenio {
  tarifario?: {
    id: number;
    nombre: string;
  } | null;
}
