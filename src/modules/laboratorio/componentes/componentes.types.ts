import type { InferSelectModel } from 'drizzle-orm';
import { componentes } from '../../../db';

export type Componente = InferSelectModel<typeof componentes>;

export interface CreateComponenteInput {
  nombre: string;
  valores_referenciales?: string[];
  unidad_medida?: string | null;
  area_id?: number | null;
  metodo_id?: number | null;
  muestras_ids?: number[];
  valor_alerta_min?: number | string | null;
  valor_alerta_max?: number | string | null;
}

export interface UpdateComponenteInput extends Partial<CreateComponenteInput> {
  activo?: boolean;
}

export interface ComponenteWithRelations extends Componente {
  area_nombre?: string;
  metodo_nombre?: string;
  muestras_ids?: number[];
  muestras?: Array<{ id: number; nombre: string }>;
}
