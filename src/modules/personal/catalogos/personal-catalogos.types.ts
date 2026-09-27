export type CatalogoTipo = 'cargos' | 'areas' | 'tipos-contrato' | 'motivos-cese';

export interface PersonalCatalogoItem {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  total_personal?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePersonalCatalogoDTO {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface UpdatePersonalCatalogoDTO {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
}
