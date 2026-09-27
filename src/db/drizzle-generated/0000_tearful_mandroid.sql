-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"rol_id" integer NOT NULL,
	"activo" boolean DEFAULT true,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"personal_id" integer,
	CONSTRAINT "usuarios_username_key" UNIQUE("username"),
	CONSTRAINT "usuarios_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(50) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "roles_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "roles_permisos" (
	"id" serial PRIMARY KEY NOT NULL,
	"rol_id" integer NOT NULL,
	"permiso_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "roles_permisos_rol_id_permiso_id_key" UNIQUE("permiso_id","rol_id")
);
--> statement-breakpoint
CREATE TABLE "permisos" (
	"id" serial PRIMARY KEY NOT NULL,
	"modulo" varchar(50) NOT NULL,
	"submodulo" varchar(50),
	"accion" varchar(50) NOT NULL,
	"codigo" varchar(100) NOT NULL,
	"descripcion" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "permisos_codigo_key" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "convenios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_empresa" varchar(200) NOT NULL,
	"ruc" varchar(11) NOT NULL,
	"direccion" text,
	"telefono" varchar(20),
	"email" varchar(100),
	"tarifario_id" integer,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"logo_url" varchar(500),
	CONSTRAINT "convenios_ruc_key" UNIQUE("ruc")
);
--> statement-breakpoint
CREATE TABLE "tarifarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "tarifarios_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "analisis" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"descripcion" text,
	"sinonimia" text[],
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"componentes_ids" integer[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "areas_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "metodos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "metodos_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "tarifario_precios" (
	"id" serial PRIMARY KEY NOT NULL,
	"tarifario_id" integer NOT NULL,
	"analisis_id" integer NOT NULL,
	"precio" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "tarifario_precios_tarifario_id_analisis_id_key" UNIQUE("analisis_id","tarifario_id")
);
--> statement-breakpoint
CREATE TABLE "componentes" (
	"id" serial PRIMARY KEY NOT NULL,
	"analisis_id" integer,
	"nombre" varchar(200) NOT NULL,
	"unidad_medida" varchar(50),
	"area_id" integer,
	"metodo_id" integer,
	"orden" integer DEFAULT 0,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"valores_referenciales" text[] DEFAULT '{""}',
	"valor_alerta_min" numeric(10, 4) DEFAULT 'NULL',
	"valor_alerta_max" numeric(10, 4) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE "pacientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"dni" varchar(20) NOT NULL,
	"nombres" varchar(100) NOT NULL,
	"apellido_paterno" varchar(100) NOT NULL,
	"apellido_materno" varchar(100) NOT NULL,
	"nombre_completo" varchar(300) NOT NULL,
	"fecha_nacimiento" date,
	"genero" char(1),
	"telefono" varchar(20),
	"email" varchar(100),
	"direccion" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "pacientes_dni_key" UNIQUE("dni")
);
--> statement-breakpoint
CREATE TABLE "sedes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"direccion" text,
	"telefono" varchar(20),
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "sedes_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "tipos_cliente" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(50) NOT NULL,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "tipos_cliente_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "resultados" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden_analisis_id" integer NOT NULL,
	"componente_id" integer NOT NULL,
	"resultado" text,
	"valor_referencial" varchar(200),
	"observacion" text,
	"usuario_registro_id" integer,
	"fecha_registro" timestamp DEFAULT CURRENT_TIMESTAMP,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "resultados_orden_analisis_id_componente_id_key" UNIQUE("componente_id","orden_analisis_id")
);
--> statement-breakpoint
CREATE TABLE "configuracion_sistema" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_nombre" varchar(200) DEFAULT 'LABORATORIO' NOT NULL,
	"empresa_razon_social" varchar(200),
	"empresa_ruc" varchar(20),
	"empresa_direccion" varchar(300),
	"empresa_telefono" varchar(50),
	"empresa_email" varchar(100),
	"empresa_web" varchar(150),
	"logo_principal" varchar(255),
	"logo_secundario" varchar(255),
	"encabezado_reporte" text,
	"pie_reporte" text,
	"moneda" varchar(10) DEFAULT 'PEN',
	"igv_porcentaje" numeric(5, 2) DEFAULT '18.00',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"regimen_laboral" varchar(20) DEFAULT 'GENERAL'
);
--> statement-breakpoint
CREATE TABLE "componente_muestras" (
	"id" serial PRIMARY KEY NOT NULL,
	"componente_id" integer NOT NULL,
	"muestra_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "componente_muestras_componente_id_muestra_id_key" UNIQUE("componente_id","muestra_id")
);
--> statement-breakpoint
CREATE TABLE "muestras" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "muestras_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "orden_analisis" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden_id" integer NOT NULL,
	"analisis_id" integer NOT NULL,
	"precio" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"muestras_ids" integer[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "usuarios_sedes" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"sede_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "usuarios_sedes_usuario_id_sede_id_key" UNIQUE("sede_id","usuario_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_connection_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(100) DEFAULT 'default' NOT NULL,
	"is_connected" boolean DEFAULT false,
	"phone_number" varchar(20),
	"last_connected_at" timestamp,
	"last_disconnected_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "whatsapp_connection_status_session_id_key" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(100) DEFAULT 'default' NOT NULL,
	"data_key" varchar(255) NOT NULL,
	"data_value" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "whatsapp_sessions_session_id_data_key_key" UNIQUE("data_key","session_id")
);
--> statement-breakpoint
CREATE TABLE "ordenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero_atencion" integer NOT NULL,
	"paciente_id" integer NOT NULL,
	"sede_id" integer NOT NULL,
	"tipo_cliente_id" integer NOT NULL,
	"convenio_id" integer,
	"usuario_registro_id" integer NOT NULL,
	"estado" varchar(20) DEFAULT 'REGISTRADA' NOT NULL,
	"nota" text,
	"fecha_registro" timestamp DEFAULT CURRENT_TIMESTAMP,
	"fecha_aprobacion" timestamp,
	"usuario_aprobacion_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"muestra_recepcionada" boolean DEFAULT false,
	"medico" varchar(255),
	"usuario_recepcion_id" integer,
	"fecha_recepcion" timestamp,
	"tipo_paciente" varchar(20) DEFAULT 'PARTICULAR',
	"interpretacion_ia" text,
	"condiciones_preanaliticas" text,
	CONSTRAINT "ordenes_numero_atencion_key" UNIQUE("numero_atencion"),
	CONSTRAINT "ordenes_estado_check" CHECK ((estado)::text = ANY ((ARRAY['REGISTRADA'::character varying, 'MUESTRA_RECIBIDA'::character varying, 'CON_RESULTADOS'::character varying, 'APROBADA'::character varying, 'IMPRESO'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "personal_sedes" (
	"id" serial PRIMARY KEY NOT NULL,
	"personal_id" integer NOT NULL,
	"sede_id" integer NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "personal_sedes_personal_id_sede_id_key" UNIQUE("personal_id","sede_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden_id" integer,
	"phone_number" varchar(20) NOT NULL,
	"message_type" varchar(50) DEFAULT 'document',
	"status" varchar(50) DEFAULT 'pending',
	"error_message" text,
	"sent_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"message_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "personal_cargos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "personal_cargos_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "personal_contratos" (
	"id" serial PRIMARY KEY NOT NULL,
	"personal_id" integer NOT NULL,
	"tipo_contrato_id" integer,
	"tipo_contrato_nombre" varchar(100),
	"numero_contrato" varchar(50),
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date,
	"es_indefinido" boolean DEFAULT false,
	"cargo" varchar(100),
	"sueldo_pactado" numeric(10, 2),
	"archivo_url" text,
	"estado" varchar(30) DEFAULT 'VIGENTE',
	"observaciones" text,
	"usuario_registro_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "personal_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "personal_areas_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "personal_tipos_contrato" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "personal_tipos_contrato_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "personal" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo_documento" varchar(20) DEFAULT 'DNI',
	"numero_documento" varchar(30),
	"nombres" varchar(100) NOT NULL,
	"apellidos" varchar(100) NOT NULL,
	"cargo" varchar(100),
	"area" varchar(100) DEFAULT 'Laboratorio',
	"email" varchar(100),
	"telefono" varchar(30),
	"direccion" text,
	"fecha_nacimiento" date,
	"fecha_ingreso" date,
	"tipo_contrato" varchar(50),
	"sueldo_base" numeric(10, 2),
	"colegiatura" varchar(50),
	"firma_url" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"cargo_id" integer,
	"area_id" integer,
	"tipo_contrato_id" integer,
	"fecha_cese" date,
	"motivo_cese" varchar(100),
	"observaciones_cese" text,
	"motivo_cese_id" integer,
	CONSTRAINT "personal_numero_documento_key" UNIQUE("numero_documento")
);
--> statement-breakpoint
CREATE TABLE "personal_motivos_cese" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "personal_motivos_cese_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "personal_historial_laboral" (
	"id" serial PRIMARY KEY NOT NULL,
	"personal_id" integer NOT NULL,
	"tipo_evento" varchar(50) NOT NULL,
	"fecha_evento" date NOT NULL,
	"cargo" varchar(100),
	"area" varchar(100),
	"tipo_contrato" varchar(100),
	"sueldo_base" numeric(10, 2),
	"motivo_cese_id" integer,
	"motivo_cese_texto" varchar(150),
	"observaciones" text,
	"usuario_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "personal_vacaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"personal_id" integer NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date NOT NULL,
	"dias_solicitados" integer NOT NULL,
	"estado" varchar(30) DEFAULT 'PENDIENTE' NOT NULL,
	"motivo" text,
	"observaciones_aprobador" text,
	"aprobado_por_id" integer,
	"fecha_aprobacion" date,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "personal_vacaciones_dias_solicitados_check" CHECK (dias_solicitados > 0),
	CONSTRAINT "check_vacaciones_fechas" CHECK (fecha_fin >= fecha_inicio)
);
--> statement-breakpoint
CREATE TABLE "personal_asistencia" (
	"id" serial PRIMARY KEY NOT NULL,
	"personal_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"hora_entrada" time,
	"hora_salida" time,
	"minutos_tardanza" integer DEFAULT 0 NOT NULL,
	"estado" varchar(40) DEFAULT 'PRESENTE' NOT NULL,
	"justificacion" text,
	"sede_id" integer,
	"usuario_registro_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "uq_personal_fecha" UNIQUE("fecha","personal_id")
);
--> statement-breakpoint
CREATE TABLE "personal_documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"personal_id" integer NOT NULL,
	"tipo_documento" varchar(50) NOT NULL,
	"codigo_emision" varchar(50) NOT NULL,
	"fecha_emision" date DEFAULT CURRENT_DATE NOT NULL,
	"destinatario" varchar(200) DEFAULT 'A quien corresponda',
	"cargo_consignado" varchar(100),
	"remuneracion_consignada" numeric(10, 2),
	"archivo_url" text,
	"observaciones" text,
	"emitido_por_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "personal_documentos_codigo_emision_key" UNIQUE("codigo_emision")
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "public"."permisos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_tarifario_id_fkey" FOREIGN KEY ("tarifario_id") REFERENCES "public"."tarifarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifario_precios" ADD CONSTRAINT "tarifario_precios_tarifario_id_fkey" FOREIGN KEY ("tarifario_id") REFERENCES "public"."tarifarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifario_precios" ADD CONSTRAINT "tarifario_precios_analisis_id_fkey" FOREIGN KEY ("analisis_id") REFERENCES "public"."analisis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "componentes" ADD CONSTRAINT "componentes_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "componentes" ADD CONSTRAINT "componentes_metodo_id_fkey" FOREIGN KEY ("metodo_id") REFERENCES "public"."metodos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_orden_analisis_id_fkey" FOREIGN KEY ("orden_analisis_id") REFERENCES "public"."orden_analisis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_componente_id_fkey" FOREIGN KEY ("componente_id") REFERENCES "public"."componentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultados" ADD CONSTRAINT "resultados_usuario_registro_id_fkey" FOREIGN KEY ("usuario_registro_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "componente_muestras" ADD CONSTRAINT "componente_muestras_componente_id_fkey" FOREIGN KEY ("componente_id") REFERENCES "public"."componentes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "componente_muestras" ADD CONSTRAINT "componente_muestras_muestra_id_fkey" FOREIGN KEY ("muestra_id") REFERENCES "public"."muestras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_analisis" ADD CONSTRAINT "orden_analisis_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_analisis" ADD CONSTRAINT "orden_analisis_analisis_id_fkey" FOREIGN KEY ("analisis_id") REFERENCES "public"."analisis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_sedes" ADD CONSTRAINT "usuarios_sedes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_sedes" ADD CONSTRAINT "usuarios_sedes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_tipo_cliente_id_fkey" FOREIGN KEY ("tipo_cliente_id") REFERENCES "public"."tipos_cliente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_usuario_registro_id_fkey" FOREIGN KEY ("usuario_registro_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_usuario_aprobacion_id_fkey" FOREIGN KEY ("usuario_aprobacion_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_usuario_recepcion_id_fkey" FOREIGN KEY ("usuario_recepcion_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_sedes" ADD CONSTRAINT "personal_sedes_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_sedes" ADD CONSTRAINT "personal_sedes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages_log" ADD CONSTRAINT "whatsapp_messages_log_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages_log" ADD CONSTRAINT "whatsapp_messages_log_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_contratos" ADD CONSTRAINT "personal_contratos_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_contratos" ADD CONSTRAINT "personal_contratos_tipo_contrato_id_fkey" FOREIGN KEY ("tipo_contrato_id") REFERENCES "public"."personal_tipos_contrato"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_contratos" ADD CONSTRAINT "personal_contratos_usuario_registro_id_fkey" FOREIGN KEY ("usuario_registro_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal" ADD CONSTRAINT "personal_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "public"."personal_cargos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal" ADD CONSTRAINT "personal_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "public"."personal_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal" ADD CONSTRAINT "personal_tipo_contrato_id_fkey" FOREIGN KEY ("tipo_contrato_id") REFERENCES "public"."personal_tipos_contrato"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal" ADD CONSTRAINT "personal_motivo_cese_id_fkey" FOREIGN KEY ("motivo_cese_id") REFERENCES "public"."personal_motivos_cese"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_historial_laboral" ADD CONSTRAINT "personal_historial_laboral_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_historial_laboral" ADD CONSTRAINT "personal_historial_laboral_motivo_cese_id_fkey" FOREIGN KEY ("motivo_cese_id") REFERENCES "public"."personal_motivos_cese"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_historial_laboral" ADD CONSTRAINT "personal_historial_laboral_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_vacaciones" ADD CONSTRAINT "personal_vacaciones_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_vacaciones" ADD CONSTRAINT "personal_vacaciones_aprobado_por_id_fkey" FOREIGN KEY ("aprobado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_asistencia" ADD CONSTRAINT "personal_asistencia_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_asistencia" ADD CONSTRAINT "personal_asistencia_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_asistencia" ADD CONSTRAINT "personal_asistencia_usuario_registro_id_fkey" FOREIGN KEY ("usuario_registro_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_documentos" ADD CONSTRAINT "personal_documentos_personal_id_fkey" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_documentos" ADD CONSTRAINT "personal_documentos_emitido_por_id_fkey" FOREIGN KEY ("emitido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usuarios_email" ON "usuarios" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_usuarios_personal_id" ON "usuarios" USING btree ("personal_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_usuarios_rol_id" ON "usuarios" USING btree ("rol_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_usuarios_username" ON "usuarios" USING btree ("username" text_ops);--> statement-breakpoint
CREATE INDEX "idx_roles_permisos_permiso" ON "roles_permisos" USING btree ("permiso_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_roles_permisos_rol" ON "roles_permisos" USING btree ("rol_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_permisos_codigo" ON "permisos" USING btree ("codigo" text_ops);--> statement-breakpoint
CREATE INDEX "idx_permisos_modulo" ON "permisos" USING btree ("modulo" text_ops);--> statement-breakpoint
CREATE INDEX "idx_analisis_componentes_ids" ON "analisis" USING gin ("componentes_ids" array_ops);--> statement-breakpoint
CREATE INDEX "idx_analisis_nombre" ON "analisis" USING btree ("nombre" text_ops);--> statement-breakpoint
CREATE INDEX "idx_analisis_sinonimia" ON "analisis" USING gin ("sinonimia" array_ops);--> statement-breakpoint
CREATE INDEX "idx_tarifario_precios_analisis" ON "tarifario_precios" USING btree ("analisis_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tarifario_precios_tarifario" ON "tarifario_precios" USING btree ("tarifario_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_componentes_analisis_id" ON "componentes" USING btree ("analisis_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_pacientes_dni" ON "pacientes" USING btree ("dni" text_ops);--> statement-breakpoint
CREATE INDEX "idx_pacientes_nombre_completo" ON "pacientes" USING btree ("nombre_completo" text_ops);--> statement-breakpoint
CREATE INDEX "idx_resultados_componente_id" ON "resultados" USING btree ("componente_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_resultados_orden_analisis_id" ON "resultados" USING btree ("orden_analisis_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_componente_muestras_componente" ON "componente_muestras" USING btree ("componente_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_componente_muestras_muestra" ON "componente_muestras" USING btree ("muestra_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_orden_analisis_analisis_id" ON "orden_analisis" USING btree ("analisis_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_orden_analisis_orden_id" ON "orden_analisis" USING btree ("orden_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_usuarios_sedes_sede" ON "usuarios_sedes" USING btree ("sede_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_usuarios_sedes_usuario" ON "usuarios_sedes" USING btree ("usuario_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_whatsapp_sessions_key" ON "whatsapp_sessions" USING btree ("data_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_whatsapp_sessions_session_id" ON "whatsapp_sessions" USING btree ("session_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ordenes_estado" ON "ordenes" USING btree ("estado" text_ops);--> statement-breakpoint
CREATE INDEX "idx_ordenes_fecha_registro" ON "ordenes" USING btree ("fecha_registro" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_ordenes_medico" ON "ordenes" USING btree ("medico" text_ops) WHERE (medico IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_ordenes_numero_atencion" ON "ordenes" USING btree ("numero_atencion" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_ordenes_paciente_id" ON "ordenes" USING btree ("paciente_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_sedes_personal" ON "personal_sedes" USING btree ("personal_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_sedes_sede" ON "personal_sedes" USING btree ("sede_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_orden" ON "whatsapp_messages_log" USING btree ("orden_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_phone" ON "whatsapp_messages_log" USING btree ("phone_number" text_ops);--> statement-breakpoint
CREATE INDEX "idx_whatsapp_messages_status" ON "whatsapp_messages_log" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_cargos_activo" ON "personal_cargos" USING btree ("activo" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_contratos_estado" ON "personal_contratos" USING btree ("estado" text_ops);--> statement-breakpoint
CREATE INDEX "idx_contratos_fecha_fin" ON "personal_contratos" USING btree ("fecha_fin" date_ops);--> statement-breakpoint
CREATE INDEX "idx_contratos_personal_id" ON "personal_contratos" USING btree ("personal_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_areas_activo" ON "personal_areas" USING btree ("activo" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_tipos_contrato_activo" ON "personal_tipos_contrato" USING btree ("activo" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_activo" ON "personal" USING btree ("activo" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_area_id" ON "personal" USING btree ("area_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_cargo" ON "personal" USING btree ("cargo" text_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_cargo_id" ON "personal" USING btree ("cargo_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_fecha_cese" ON "personal" USING btree ("fecha_cese" date_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_motivo_cese" ON "personal" USING btree ("motivo_cese" text_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_motivo_cese_id" ON "personal" USING btree ("motivo_cese_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_numero_documento" ON "personal" USING btree ("numero_documento" text_ops);--> statement-breakpoint
CREATE INDEX "idx_personal_tipo_contrato_id" ON "personal" USING btree ("tipo_contrato_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_historial_fecha_evento" ON "personal_historial_laboral" USING btree ("fecha_evento" date_ops);--> statement-breakpoint
CREATE INDEX "idx_historial_personal_id" ON "personal_historial_laboral" USING btree ("personal_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_historial_tipo_evento" ON "personal_historial_laboral" USING btree ("tipo_evento" text_ops);--> statement-breakpoint
CREATE INDEX "idx_vacaciones_estado" ON "personal_vacaciones" USING btree ("estado" text_ops);--> statement-breakpoint
CREATE INDEX "idx_vacaciones_fechas" ON "personal_vacaciones" USING btree ("fecha_inicio" date_ops,"fecha_fin" date_ops);--> statement-breakpoint
CREATE INDEX "idx_vacaciones_personal_id" ON "personal_vacaciones" USING btree ("personal_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_asistencia_estado" ON "personal_asistencia" USING btree ("estado" text_ops);--> statement-breakpoint
CREATE INDEX "idx_asistencia_fecha" ON "personal_asistencia" USING btree ("fecha" date_ops);--> statement-breakpoint
CREATE INDEX "idx_asistencia_personal_id" ON "personal_asistencia" USING btree ("personal_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_documentos_codigo" ON "personal_documentos" USING btree ("codigo_emision" text_ops);--> statement-breakpoint
CREATE INDEX "idx_documentos_personal_id" ON "personal_documentos" USING btree ("personal_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_documentos_tipo" ON "personal_documentos" USING btree ("tipo_documento" text_ops);
*/