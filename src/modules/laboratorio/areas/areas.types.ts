import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { areas } from '../../../db';

export type Area = InferSelectModel<typeof areas>;
export type CreateAreaInput = {
  nombre: string;
  descripcion?: string | null;
};
export type UpdateAreaInput = Partial<CreateAreaInput> & {
  activo?: boolean;
};
