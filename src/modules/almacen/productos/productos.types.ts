import type { InferSelectModel } from 'drizzle-orm';
import type { almacenProductos } from '../../../db';

export type AlmacenProducto = InferSelectModel<typeof almacenProductos>;
export interface AlmacenProductoListado extends AlmacenProducto {
  categoria_nombre: string | null;
  unidad_codigo: string;
  unidad_nombre?: string | null;
  unidad_medida_codigo?: string | null;
  unidad_medida_nombre?: string | null;
}
