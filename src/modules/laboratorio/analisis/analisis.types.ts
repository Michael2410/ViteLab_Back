import type { InferSelectModel } from 'drizzle-orm';
import { analisis } from '../../../db';

export type Analisis = InferSelectModel<typeof analisis>;

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
  componentes: any[];
}
