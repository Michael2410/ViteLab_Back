import type { InferSelectModel } from 'drizzle-orm';
import { metodos } from '../../../db';

export type Metodo = InferSelectModel<typeof metodos>;
export type CreateMetodoInput = {
  nombre: string;
  descripcion?: string | null;
};
export type UpdateMetodoInput = Partial<CreateMetodoInput> & {
  activo?: boolean;
};
