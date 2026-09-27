import type { InferSelectModel } from 'drizzle-orm';
import { tiposCliente } from '../../../db';

export type TipoCliente = InferSelectModel<typeof tiposCliente>;
export type CreateTipoClienteInput = {
  nombre: string;
};
export type UpdateTipoClienteInput = Partial<CreateTipoClienteInput> & {
  activo?: boolean;
};
