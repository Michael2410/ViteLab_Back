import type { InferSelectModel } from 'drizzle-orm';
import { sedes } from '../../db';

export type Sede = InferSelectModel<typeof sedes>;

export interface CreateSedeInput {
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

export interface UpdateSedeInput extends Partial<CreateSedeInput> {
  activo?: boolean;
}
