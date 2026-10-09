export interface PlantillaDocumento {
  id: number;
  tipo_documento: string;
  nombre: string;
  titulo_documento: string;
  cuerpo_template: string;
  parrafo_cierre?: string | null;
  ciudad_defecto?: string | null;
  mostrar_logo?: boolean | null;
  firmante_nombre?: string | null;
  firmante_cargo?: string | null;
  firmante_firma_url?: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CrearPlantillaDTO {
  tipo_documento: string;
  nombre: string;
  titulo_documento: string;
  cuerpo_template: string;
  parrafo_cierre?: string | null;
  ciudad_defecto?: string | null;
  mostrar_logo?: boolean;
  firmante_nombre?: string | null;
  firmante_cargo?: string | null;
  firmante_firma_url?: string | null;
  activo?: boolean;
}

export interface ActualizarPlantillaDTO {
  nombre?: string;
  titulo_documento?: string;
  cuerpo_template?: string;
  parrafo_cierre?: string | null;
  ciudad_defecto?: string | null;
  mostrar_logo?: boolean;
  firmante_nombre?: string | null;
  firmante_cargo?: string | null;
  firmante_firma_url?: string | null;
  activo?: boolean;
}
