import type { InferSelectModel } from 'drizzle-orm';
import { tarifarios, tarifarioPrecios } from '../../../db';

export type Tarifario = InferSelectModel<typeof tarifarios>;
export type TarifarioPrecio = InferSelectModel<typeof tarifarioPrecios>;

export interface CreateTarifarioInput {
  nombre: string;
  descripcion?: string | null;
}

export interface UpdateTarifarioInput extends Partial<CreateTarifarioInput> {
  activo?: boolean;
}

export interface CreateTarifarioPrecioInput {
  tarifario_id: number;
  analisis_id: number;
  precio: number | string;
}

export interface UpdateTarifarioPrecioInput {
  precio: number | string;
}

export interface TarifarioWithPrecios extends Tarifario {
  precios: Array<{
    id: number;
    analisis_id: number;
    analisis_nombre: string;
    precio: number | string;
  }>;
}
