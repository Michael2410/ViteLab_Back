import type {
  almacenUnidadesMedida,
  almacenCategorias,
  almacenAlmacenes,
  almacenUbicaciones,
} from '../../../db';

export type AlmacenUnidadMedida = typeof almacenUnidadesMedida.$inferSelect;
export type AlmacenCategoria = typeof almacenCategorias.$inferSelect;
export type AlmacenEntity = typeof almacenAlmacenes.$inferSelect;
export type AlmacenUbicacion = typeof almacenUbicaciones.$inferSelect;

export type AlmacenConSede = AlmacenEntity & {
  sede_nombre?: string | null;
};
