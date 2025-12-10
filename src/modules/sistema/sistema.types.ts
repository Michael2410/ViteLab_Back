// Tipos para el módulo de configuración del sistema

export interface ConfiguracionSistema {
  id: number;
  empresa_nombre: string;
  empresa_razon_social: string | null;
  empresa_ruc: string | null;
  empresa_direccion: string | null;
  empresa_telefono: string | null;
  empresa_email: string | null;
  empresa_web: string | null;
  logo_principal: string | null;
  logo_secundario: string | null;
  encabezado_reporte: string | null;
  pie_reporte: string | null;
  moneda: string;
  igv_porcentaje: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateConfiguracionInput {
  empresa_nombre?: string;
  empresa_razon_social?: string;
  empresa_ruc?: string;
  empresa_direccion?: string;
  empresa_telefono?: string;
  empresa_email?: string;
  empresa_web?: string;
  logo_principal?: string;
  logo_secundario?: string;
  encabezado_reporte?: string;
  pie_reporte?: string;
  moneda?: string;
  igv_porcentaje?: number;
}
