import type { InferSelectModel } from 'drizzle-orm';
import type { almacenProveedores } from '../../../db';

export type AlmacenProveedor = InferSelectModel<typeof almacenProveedores>;
