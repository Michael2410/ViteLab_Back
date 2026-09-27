import type { InferSelectModel } from 'drizzle-orm';
import { muestras } from '../../../db';

export type Muestra = InferSelectModel<typeof muestras>;
export type CreateMuestraInput = {
  nombre: string;
  descripcion?: string | null;
};
export type UpdateMuestraInput = Partial<CreateMuestraInput> & {
  activo?: boolean;
};
