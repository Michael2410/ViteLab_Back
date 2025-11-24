export enum EstadoOrden {
  REGISTRADA = 'REGISTRADA',
  CON_RESULTADOS = 'CON_RESULTADOS',
  APROBADA = 'APROBADA',
}

// PACIENTE
export interface Paciente {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: Date;
  sexo: 'M' | 'F';
  telefono?: string;
  email?: string;
  direccion?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePacienteInput {
  dni: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: Date;
  sexo: 'M' | 'F';
  telefono?: string;
  email?: string;
  direccion?: string;
}

// RESPUESTA DE API DNI
export interface ApiDniResponse {
  success: boolean;
  data?: {
    dni: string;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    fechaNacimiento?: string;
  };
  message?: string;
}

// ORDEN
export interface Orden {
  id: number;
  numero_atencion: number;
  paciente_id: number;
  sede_id: number;
  tipo_cliente_id: number;
  convenio_id?: number;
  estado: EstadoOrden;
  fecha_registro: Date;
  fecha_aprobacion?: Date;
  nota?: string;
  total?: number;
  usuario_registro_id: number;
  usuario_aprobacion_id?: number;
  created_at: Date;
  updated_at: Date;
  // Campos adicionales para vistas
  paciente_dni?: string;
  paciente_nombres?: string;
  paciente_apellidos?: string;
  sede_nombre?: string;
  tipo_cliente_nombre?: string;
  convenio_nombre?: string;
}

export interface CreateOrdenInput {
  paciente: CreatePacienteInput;
  sede_id: number;
  tipo_cliente_id: number;
  convenio_id?: number;
  analisis_ids: number[];
  nota?: string;
}

export interface UpdateOrdenInput {
  sede_id?: number;
  tipo_cliente_id?: number;
  convenio_id?: number;
  nota?: string;
}

// ORDEN_ANALISIS
export interface OrdenAnalisis {
  id: number;
  orden_id: number;
  analisis_id: number;
  precio: number;
  created_at: Date;
}

export interface CreateOrdenAnalisisInput {
  orden_id: number;
  analisis_id: number;
  precio: number;
}

// ORDEN CON DETALLES
export interface OrdenDetalle extends Orden {
  paciente: {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    fecha_nacimiento: Date;
    sexo: string;
    telefono?: string;
    email?: string;
  };
  sede: {
    id: number;
    nombre: string;
    direccion?: string;
  };
  tipo_cliente: {
    id: number;
    nombre: string;
  };
  convenio?: {
    id: number;
    nombre: string;
    tarifario_id?: number;
  };
  analisis: Array<{
    id: number;
    analisis_id: number;
    codigo: string;
    nombre: string;
    precio: number;
  }>;
  usuario_registro: {
    id: number;
    nombre: string;
    apellido: string;
  };
  usuario_resultados?: {
    id: number;
    nombre: string;
    apellido: string;
  };
  usuario_aprobacion?: {
    id: number;
    nombre: string;
    apellido: string;
  };
}

// FILTROS
export interface OrdenFilters {
  estado?: EstadoOrden;
  sede_id?: number;
  fecha_desde?: Date;
  fecha_hasta?: Date;
  paciente_dni?: string;
  numero_orden?: string;
  page?: number;
  limit?: number;
}
