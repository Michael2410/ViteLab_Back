import { pgTable, index, foreignKey, unique, serial, varchar, integer, boolean, text, timestamp, numeric, date, char, check, time, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const usuarios = pgTable("usuarios", {
	id: serial().primaryKey().notNull(),
	identity_id: uuid("identity_id"),
	username: varchar({ length: 50 }).notNull(),
	email: varchar({ length: 100 }).notNull(),
	password_hash: varchar("password_hash", { length: 255 }).notNull(),
	rol_id: integer("rol_id").notNull(),
	activo: boolean().default(true),
	refresh_token: text("refresh_token"),
	refresh_token_expires_at: timestamp("refresh_token_expires_at", { mode: 'string' }),
	two_factor_enabled: boolean("two_factor_enabled").default(false),
	two_factor_secret: text("two_factor_secret"),
	two_factor_temp_secret: text("two_factor_temp_secret"),
	two_factor_backup_codes: text("two_factor_backup_codes"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	personal_id: integer("personal_id"),
}, (table) => [
	index("idx_usuarios_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_usuarios_personal_id").using("btree", table.personal_id.asc().nullsLast().op("int4_ops")),
	index("idx_usuarios_rol_id").using("btree", table.rol_id.asc().nullsLast().op("int4_ops")),
	index("idx_usuarios_username").using("btree", table.username.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.rol_id],
			foreignColumns: [roles.id],
			name: "usuarios_rol_id_fkey"
		}),
	foreignKey({
			columns: [table.personal_id],
			foreignColumns: [personal.id],
			name: "usuarios_personal_id_fkey"
		}).onDelete("set null"),
	unique("usuarios_username_key").on(table.username),
	unique("usuarios_email_key").on(table.email),
]);

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 50 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("roles_nombre_key").on(table.nombre),
]);

export const rolesPermisos = pgTable("roles_permisos", {
	id: serial().primaryKey().notNull(),
	rol_id: integer("rol_id").notNull(),
	permiso_id: integer("permiso_id").notNull(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_roles_permisos_permiso").using("btree", table.permiso_id.asc().nullsLast().op("int4_ops")),
	index("idx_roles_permisos_rol").using("btree", table.rol_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.rol_id],
			foreignColumns: [roles.id],
			name: "roles_permisos_rol_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.permiso_id],
			foreignColumns: [permisos.id],
			name: "roles_permisos_permiso_id_fkey"
		}).onDelete("cascade"),
	unique("roles_permisos_rol_id_permiso_id_key").on(table.permiso_id, table.rol_id),
]);

export const permisos = pgTable("permisos", {
	id: serial().primaryKey().notNull(),
	modulo: varchar({ length: 50 }).notNull(),
	submodulo: varchar({ length: 50 }),
	accion: varchar({ length: 50 }).notNull(),
	codigo: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_permisos_codigo").using("btree", table.codigo.asc().nullsLast().op("text_ops")),
	index("idx_permisos_modulo").using("btree", table.modulo.asc().nullsLast().op("text_ops")),
	unique("permisos_codigo_key").on(table.codigo),
]);

export const convenios = pgTable("convenios", {
	id: serial().primaryKey().notNull(),
	nombre_empresa: varchar("nombre_empresa", { length: 200 }).notNull(),
	ruc: varchar({ length: 11 }).notNull(),
	direccion: text(),
	telefono: varchar({ length: 20 }),
	email: varchar({ length: 100 }),
	tarifario_id: integer("tarifario_id"),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	logo_url: varchar("logo_url", { length: 500 }),
}, (table) => [
	foreignKey({
			columns: [table.tarifario_id],
			foreignColumns: [tarifarios.id],
			name: "convenios_tarifario_id_fkey"
		}),
	unique("convenios_ruc_key").on(table.ruc),
]);

export const tarifarios = pgTable("tarifarios", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("tarifarios_nombre_key").on(table.nombre),
]);

export const analisis = pgTable("analisis", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 200 }).notNull(),
	descripcion: text(),
	sinonimia: text().array(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	componentes_ids: integer("componentes_ids").array().default([]),
}, (table) => [
	index("idx_analisis_componentes_ids").using("gin", table.componentes_ids.asc().nullsLast().op("array_ops")),
	index("idx_analisis_nombre").using("btree", table.nombre.asc().nullsLast().op("text_ops")),
	index("idx_analisis_sinonimia").using("gin", table.sinonimia.asc().nullsLast().op("array_ops")),
]);

export const areas = pgTable("areas", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("areas_nombre_key").on(table.nombre),
]);

export const metodos = pgTable("metodos", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("metodos_nombre_key").on(table.nombre),
]);

export const tarifarioPrecios = pgTable("tarifario_precios", {
	id: serial().primaryKey().notNull(),
	tarifario_id: integer("tarifario_id").notNull(),
	analisis_id: integer("analisis_id").notNull(),
	precio: numeric({ precision: 10, scale:  2 }).notNull(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_tarifario_precios_analisis").using("btree", table.analisis_id.asc().nullsLast().op("int4_ops")),
	index("idx_tarifario_precios_tarifario").using("btree", table.tarifario_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.tarifario_id],
			foreignColumns: [tarifarios.id],
			name: "tarifario_precios_tarifario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.analisis_id],
			foreignColumns: [analisis.id],
			name: "tarifario_precios_analisis_id_fkey"
		}).onDelete("cascade"),
	unique("tarifario_precios_tarifario_id_analisis_id_key").on(table.analisis_id, table.tarifario_id),
]);

export const componentes = pgTable("componentes", {
	id: serial().primaryKey().notNull(),
	analisis_id: integer("analisis_id"),
	nombre: varchar({ length: 200 }).notNull(),
	unidad_medida: varchar("unidad_medida", { length: 50 }),
	area_id: integer("area_id"),
	metodo_id: integer("metodo_id"),
	orden: integer().default(0),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	valores_referenciales: text("valores_referenciales").array().default([""]),
	valor_alerta_min: numeric("valor_alerta_min", { precision: 10, scale:  4 }).default('NULL'),
	valor_alerta_max: numeric("valor_alerta_max", { precision: 10, scale:  4 }).default('NULL'),
}, (table) => [
	index("idx_componentes_analisis_id").using("btree", table.analisis_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.area_id],
			foreignColumns: [areas.id],
			name: "componentes_area_id_fkey"
		}),
	foreignKey({
			columns: [table.metodo_id],
			foreignColumns: [metodos.id],
			name: "componentes_metodo_id_fkey"
		}),
]);

export const pacientes = pgTable("pacientes", {
	id: serial().primaryKey().notNull(),
	dni: varchar({ length: 20 }).notNull(),
	nombres: varchar({ length: 100 }).notNull(),
	apellido_paterno: varchar("apellido_paterno", { length: 100 }).notNull(),
	apellido_materno: varchar("apellido_materno", { length: 100 }).notNull(),
	nombre_completo: varchar("nombre_completo", { length: 300 }).notNull(),
	fecha_nacimiento: date("fecha_nacimiento"),
	genero: char({ length: 1 }),
	telefono: varchar({ length: 20 }),
	email: varchar({ length: 100 }),
	direccion: text(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_pacientes_dni").using("btree", table.dni.asc().nullsLast().op("text_ops")),
	index("idx_pacientes_nombre_completo").using("btree", table.nombre_completo.asc().nullsLast().op("text_ops")),
	unique("pacientes_dni_key").on(table.dni),
]);

export const sedes = pgTable("sedes", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	direccion: text(),
	telefono: varchar({ length: 20 }),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("sedes_nombre_key").on(table.nombre),
]);

export const tiposCliente = pgTable("tipos_cliente", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 50 }).notNull(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("tipos_cliente_nombre_key").on(table.nombre),
]);

export const resultados = pgTable("resultados", {
	id: serial().primaryKey().notNull(),
	orden_analisis_id: integer("orden_analisis_id").notNull(),
	componente_id: integer("componente_id").notNull(),
	resultado: text(),
	valor_referencial: varchar("valor_referencial", { length: 200 }),
	observacion: text(),
	usuario_registro_id: integer("usuario_registro_id"),
	fecha_registro: timestamp("fecha_registro", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_resultados_componente_id").using("btree", table.componente_id.asc().nullsLast().op("int4_ops")),
	index("idx_resultados_orden_analisis_id").using("btree", table.orden_analisis_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.orden_analisis_id],
			foreignColumns: [ordenAnalisis.id],
			name: "resultados_orden_analisis_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.componente_id],
			foreignColumns: [componentes.id],
			name: "resultados_componente_id_fkey"
		}),
	foreignKey({
			columns: [table.usuario_registro_id],
			foreignColumns: [usuarios.id],
			name: "resultados_usuario_registro_id_fkey"
		}),
	unique("resultados_orden_analisis_id_componente_id_key").on(table.componente_id, table.orden_analisis_id),
]);

export const configuracionSistema = pgTable("configuracion_sistema", {
	id: serial().primaryKey().notNull(),
	empresa_nombre: varchar("empresa_nombre", { length: 200 }).default('LABORATORIO').notNull(),
	empresa_razon_social: varchar("empresa_razon_social", { length: 200 }),
	empresa_ruc: varchar("empresa_ruc", { length: 20 }),
	empresa_direccion: varchar("empresa_direccion", { length: 300 }),
	empresa_telefono: varchar("empresa_telefono", { length: 50 }),
	empresa_email: varchar("empresa_email", { length: 100 }),
	empresa_web: varchar("empresa_web", { length: 150 }),
	logo_principal: varchar("logo_principal", { length: 255 }),
	logo_secundario: varchar("logo_secundario", { length: 255 }),
	encabezado_reporte: text("encabezado_reporte"),
	pie_reporte: text("pie_reporte"),
	moneda: varchar({ length: 10 }).default('PEN'),
	igv_porcentaje: numeric("igv_porcentaje", { precision: 5, scale:  2 }).default('18.00'),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	regimen_laboral: varchar("regimen_laboral", { length: 20 }).default('GENERAL'),
});

export const componenteMuestras = pgTable("componente_muestras", {
	id: serial().primaryKey().notNull(),
	componente_id: integer("componente_id").notNull(),
	muestra_id: integer("muestra_id").notNull(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_componente_muestras_componente").using("btree", table.componente_id.asc().nullsLast().op("int4_ops")),
	index("idx_componente_muestras_muestra").using("btree", table.muestra_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.componente_id],
			foreignColumns: [componentes.id],
			name: "componente_muestras_componente_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.muestra_id],
			foreignColumns: [muestras.id],
			name: "componente_muestras_muestra_id_fkey"
		}).onDelete("cascade"),
	unique("componente_muestras_componente_id_muestra_id_key").on(table.componente_id, table.muestra_id),
]);

export const muestras = pgTable("muestras", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("muestras_nombre_key").on(table.nombre),
]);

export const ordenAnalisis = pgTable("orden_analisis", {
	id: serial().primaryKey().notNull(),
	orden_id: integer("orden_id").notNull(),
	analisis_id: integer("analisis_id").notNull(),
	precio: numeric({ precision: 10, scale:  2 }).notNull(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	muestras_ids: integer("muestras_ids").array().default([]),
}, (table) => [
	index("idx_orden_analisis_analisis_id").using("btree", table.analisis_id.asc().nullsLast().op("int4_ops")),
	index("idx_orden_analisis_orden_id").using("btree", table.orden_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.orden_id],
			foreignColumns: [ordenes.id],
			name: "orden_analisis_orden_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.analisis_id],
			foreignColumns: [analisis.id],
			name: "orden_analisis_analisis_id_fkey"
		}),
]);

export const usuariosSedes = pgTable("usuarios_sedes", {
	id: serial().primaryKey().notNull(),
	usuario_id: integer("usuario_id").notNull(),
	sede_id: integer("sede_id").notNull(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_usuarios_sedes_sede").using("btree", table.sede_id.asc().nullsLast().op("int4_ops")),
	index("idx_usuarios_sedes_usuario").using("btree", table.usuario_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.usuario_id],
			foreignColumns: [usuarios.id],
			name: "usuarios_sedes_usuario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sede_id],
			foreignColumns: [sedes.id],
			name: "usuarios_sedes_sede_id_fkey"
		}).onDelete("cascade"),
	unique("usuarios_sedes_usuario_id_sede_id_key").on(table.sede_id, table.usuario_id),
]);

export const whatsappConnectionStatus = pgTable("whatsapp_connection_status", {
	id: serial().primaryKey().notNull(),
	session_id: varchar("session_id", { length: 100 }).default('default').notNull(),
	is_connected: boolean("is_connected").default(false),
	phone_number: varchar("phone_number", { length: 20 }),
	last_connected_at: timestamp("last_connected_at", { mode: 'string' }),
	last_disconnected_at: timestamp("last_disconnected_at", { mode: 'string' }),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("whatsapp_connection_status_session_id_key").on(table.session_id),
]);

export const whatsappSessions = pgTable("whatsapp_sessions", {
	id: serial().primaryKey().notNull(),
	session_id: varchar("session_id", { length: 100 }).default('default').notNull(),
	data_key: varchar("data_key", { length: 255 }).notNull(),
	data_value: text("data_value"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_whatsapp_sessions_key").using("btree", table.data_key.asc().nullsLast().op("text_ops")),
	index("idx_whatsapp_sessions_session_id").using("btree", table.session_id.asc().nullsLast().op("text_ops")),
	unique("whatsapp_sessions_session_id_data_key_key").on(table.data_key, table.session_id),
]);

export const ordenes = pgTable("ordenes", {
	id: serial().primaryKey().notNull(),
	numero_atencion: integer("numero_atencion").notNull(),
	paciente_id: integer("paciente_id").notNull(),
	sede_id: integer("sede_id").notNull(),
	tipo_cliente_id: integer("tipo_cliente_id").notNull(),
	convenio_id: integer("convenio_id"),
	usuario_registro_id: integer("usuario_registro_id").notNull(),
	estado: varchar({ length: 20 }).default('REGISTRADA').notNull(),
	nota: text(),
	fecha_registro: timestamp("fecha_registro", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	fecha_aprobacion: timestamp("fecha_aprobacion", { mode: 'string' }),
	usuario_aprobacion_id: integer("usuario_aprobacion_id"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	muestra_recepcionada: boolean("muestra_recepcionada").default(false),
	medico: varchar({ length: 255 }),
	usuario_recepcion_id: integer("usuario_recepcion_id"),
	fecha_recepcion: timestamp("fecha_recepcion", { mode: 'string' }),
	tipo_paciente: varchar("tipo_paciente", { length: 20 }).default('PARTICULAR'),
	interpretacion_ia: text("interpretacion_ia"),
	condiciones_preanaliticas: text("condiciones_preanaliticas"),
	metodo_pago: varchar("metodo_pago", { length: 30 }).default('EFECTIVO').notNull(),
}, (table) => [
	index("idx_ordenes_estado").using("btree", table.estado.asc().nullsLast().op("text_ops")),
	index("idx_ordenes_fecha_registro").using("btree", table.fecha_registro.asc().nullsLast().op("timestamp_ops")),
	index("idx_ordenes_medico").using("btree", table.medico.asc().nullsLast().op("text_ops")).where(sql`(medico IS NOT NULL)`),
	index("idx_ordenes_numero_atencion").using("btree", table.numero_atencion.asc().nullsLast().op("int4_ops")),
	index("idx_ordenes_paciente_id").using("btree", table.paciente_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.paciente_id],
			foreignColumns: [pacientes.id],
			name: "ordenes_paciente_id_fkey"
		}),
	foreignKey({
			columns: [table.sede_id],
			foreignColumns: [sedes.id],
			name: "ordenes_sede_id_fkey"
		}),
	foreignKey({
			columns: [table.tipo_cliente_id],
			foreignColumns: [tiposCliente.id],
			name: "ordenes_tipo_cliente_id_fkey"
		}),
	foreignKey({
			columns: [table.convenio_id],
			foreignColumns: [convenios.id],
			name: "ordenes_convenio_id_fkey"
		}),
	foreignKey({
			columns: [table.usuario_registro_id],
			foreignColumns: [usuarios.id],
			name: "ordenes_usuario_registro_id_fkey"
		}),
	foreignKey({
			columns: [table.usuario_aprobacion_id],
			foreignColumns: [usuarios.id],
			name: "ordenes_usuario_aprobacion_id_fkey"
		}),
	foreignKey({
			columns: [table.usuario_recepcion_id],
			foreignColumns: [usuarios.id],
			name: "ordenes_usuario_recepcion_id_fkey"
		}),
	unique("ordenes_numero_atencion_key").on(table.numero_atencion),
	check("ordenes_estado_check", sql`(estado)::text = ANY ((ARRAY['REGISTRADA'::character varying, 'MUESTRA_RECIBIDA'::character varying, 'CON_RESULTADOS'::character varying, 'APROBADA'::character varying, 'IMPRESO'::character varying])::text[])`),
]);

export const personalSedes = pgTable("personal_sedes", {
	id: serial().primaryKey().notNull(),
	personal_id: integer("personal_id").notNull(),
	sede_id: integer("sede_id").notNull(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_personal_sedes_personal").using("btree", table.personal_id.asc().nullsLast().op("int4_ops")),
	index("idx_personal_sedes_sede").using("btree", table.sede_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.personal_id],
			foreignColumns: [personal.id],
			name: "personal_sedes_personal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sede_id],
			foreignColumns: [sedes.id],
			name: "personal_sedes_sede_id_fkey"
		}).onDelete("cascade"),
	unique("personal_sedes_personal_id_sede_id_key").on(table.personal_id, table.sede_id),
]);

export const whatsappMessagesLog = pgTable("whatsapp_messages_log", {
	id: serial().primaryKey().notNull(),
	orden_id: integer("orden_id"),
	phone_number: varchar("phone_number", { length: 20 }).notNull(),
	message_type: varchar("message_type", { length: 50 }).default('document'),
	status: varchar({ length: 50 }).default('pending'),
	error_message: text("error_message"),
	sent_by: integer("sent_by"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	message_id: varchar("message_id", { length: 255 }),
}, (table) => [
	index("idx_whatsapp_messages_orden").using("btree", table.orden_id.asc().nullsLast().op("int4_ops")),
	index("idx_whatsapp_messages_phone").using("btree", table.phone_number.asc().nullsLast().op("text_ops")),
	index("idx_whatsapp_messages_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orden_id],
			foreignColumns: [ordenes.id],
			name: "whatsapp_messages_log_orden_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.sent_by],
			foreignColumns: [usuarios.id],
			name: "whatsapp_messages_log_sent_by_fkey"
		}).onDelete("set null"),
]);

export const personalCargos = pgTable("personal_cargos", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_personal_cargos_activo").using("btree", table.activo.asc().nullsLast().op("bool_ops")),
	unique("personal_cargos_nombre_key").on(table.nombre),
]);

export const personalContratos = pgTable("personal_contratos", {
	id: serial().primaryKey().notNull(),
	personal_id: integer("personal_id").notNull(),
	tipo_contrato_id: integer("tipo_contrato_id"),
	tipo_contrato_nombre: varchar("tipo_contrato_nombre", { length: 100 }),
	numero_contrato: varchar("numero_contrato", { length: 50 }),
	fecha_inicio: date("fecha_inicio").notNull(),
	fecha_fin: date("fecha_fin"),
	es_indefinido: boolean("es_indefinido").default(false),
	cargo: varchar({ length: 100 }),
	sueldo_pactado: numeric("sueldo_pactado", { precision: 10, scale:  2 }),
	archivo_url: text("archivo_url"),
	estado: varchar({ length: 30 }).default('VIGENTE'),
	observaciones: text(),
	usuario_registro_id: integer("usuario_registro_id"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_contratos_estado").using("btree", table.estado.asc().nullsLast().op("text_ops")),
	index("idx_contratos_fecha_fin").using("btree", table.fecha_fin.asc().nullsLast().op("date_ops")),
	index("idx_contratos_personal_id").using("btree", table.personal_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.personal_id],
			foreignColumns: [personal.id],
			name: "personal_contratos_personal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tipo_contrato_id],
			foreignColumns: [personalTiposContrato.id],
			name: "personal_contratos_tipo_contrato_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.usuario_registro_id],
			foreignColumns: [usuarios.id],
			name: "personal_contratos_usuario_registro_id_fkey"
		}).onDelete("set null"),
]);

export const personalAreas = pgTable("personal_areas", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_personal_areas_activo").using("btree", table.activo.asc().nullsLast().op("bool_ops")),
	unique("personal_areas_nombre_key").on(table.nombre),
]);

export const personalTiposContrato = pgTable("personal_tipos_contrato", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_personal_tipos_contrato_activo").using("btree", table.activo.asc().nullsLast().op("bool_ops")),
	unique("personal_tipos_contrato_nombre_key").on(table.nombre),
]);

export const personal = pgTable("personal", {
	id: serial().primaryKey().notNull(),
	tipo_documento: varchar("tipo_documento", { length: 20 }).default('DNI'),
	numero_documento: varchar("numero_documento", { length: 30 }),
	nombres: varchar({ length: 100 }).notNull(),
	apellidos: varchar({ length: 100 }).notNull(),
	cargo: varchar({ length: 100 }),
	area: varchar({ length: 100 }).default('Laboratorio'),
	email: varchar({ length: 100 }),
	telefono: varchar({ length: 30 }),
	direccion: text(),
	fecha_nacimiento: date("fecha_nacimiento"),
	fecha_ingreso: date("fecha_ingreso"),
	tipo_contrato: varchar("tipo_contrato", { length: 50 }),
	sueldo_base: numeric("sueldo_base", { precision: 10, scale:  2 }),
	colegiatura: varchar({ length: 50 }),
	firma_url: text("firma_url"),
	activo: boolean().default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	cargo_id: integer("cargo_id"),
	area_id: integer("area_id"),
	tipo_contrato_id: integer("tipo_contrato_id"),
	fecha_cese: date("fecha_cese"),
	motivo_cese: varchar("motivo_cese", { length: 100 }),
	observaciones_cese: text("observaciones_cese"),
	motivo_cese_id: integer("motivo_cese_id"),
}, (table) => [
	index("idx_personal_activo").using("btree", table.activo.asc().nullsLast().op("bool_ops")),
	index("idx_personal_area_id").using("btree", table.area_id.asc().nullsLast().op("int4_ops")),
	index("idx_personal_cargo").using("btree", table.cargo.asc().nullsLast().op("text_ops")),
	index("idx_personal_cargo_id").using("btree", table.cargo_id.asc().nullsLast().op("int4_ops")),
	index("idx_personal_fecha_cese").using("btree", table.fecha_cese.asc().nullsLast().op("date_ops")),
	index("idx_personal_motivo_cese").using("btree", table.motivo_cese.asc().nullsLast().op("text_ops")),
	index("idx_personal_motivo_cese_id").using("btree", table.motivo_cese_id.asc().nullsLast().op("int4_ops")),
	index("idx_personal_numero_documento").using("btree", table.numero_documento.asc().nullsLast().op("text_ops")),
	index("idx_personal_tipo_contrato_id").using("btree", table.tipo_contrato_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.cargo_id],
			foreignColumns: [personalCargos.id],
			name: "personal_cargo_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.area_id],
			foreignColumns: [personalAreas.id],
			name: "personal_area_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tipo_contrato_id],
			foreignColumns: [personalTiposContrato.id],
			name: "personal_tipo_contrato_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.motivo_cese_id],
			foreignColumns: [personalMotivosCese.id],
			name: "personal_motivo_cese_id_fkey"
		}),
	unique("personal_numero_documento_key").on(table.numero_documento),
]);

export const personalMotivosCese = pgTable("personal_motivos_cese", {
	id: serial().primaryKey().notNull(),
	nombre: varchar({ length: 100 }).notNull(),
	descripcion: text(),
	activo: boolean().default(true).notNull(),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("personal_motivos_cese_nombre_key").on(table.nombre),
]);

export const personalHistorialLaboral = pgTable("personal_historial_laboral", {
	id: serial().primaryKey().notNull(),
	personal_id: integer("personal_id").notNull(),
	tipo_evento: varchar("tipo_evento", { length: 50 }).notNull(),
	fecha_evento: date("fecha_evento").notNull(),
	cargo: varchar({ length: 100 }),
	area: varchar({ length: 100 }),
	tipo_contrato: varchar("tipo_contrato", { length: 100 }),
	sueldo_base: numeric("sueldo_base", { precision: 10, scale:  2 }),
	motivo_cese_id: integer("motivo_cese_id"),
	motivo_cese_texto: varchar("motivo_cese_texto", { length: 150 }),
	observaciones: text(),
	usuario_id: integer("usuario_id"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_historial_fecha_evento").using("btree", table.fecha_evento.asc().nullsLast().op("date_ops")),
	index("idx_historial_personal_id").using("btree", table.personal_id.asc().nullsLast().op("int4_ops")),
	index("idx_historial_tipo_evento").using("btree", table.tipo_evento.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.personal_id],
			foreignColumns: [personal.id],
			name: "personal_historial_laboral_personal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.motivo_cese_id],
			foreignColumns: [personalMotivosCese.id],
			name: "personal_historial_laboral_motivo_cese_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.usuario_id],
			foreignColumns: [usuarios.id],
			name: "personal_historial_laboral_usuario_id_fkey"
		}).onDelete("set null"),
]);

export const personalVacaciones = pgTable("personal_vacaciones", {
	id: serial().primaryKey().notNull(),
	personal_id: integer("personal_id").notNull(),
	fecha_inicio: date("fecha_inicio").notNull(),
	fecha_fin: date("fecha_fin").notNull(),
	dias_solicitados: integer("dias_solicitados").notNull(),
	estado: varchar({ length: 30 }).default('PENDIENTE').notNull(),
	motivo: text(),
	observaciones_aprobador: text("observaciones_aprobador"),
	aprobado_por_id: integer("aprobado_por_id"),
	fecha_aprobacion: date("fecha_aprobacion"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_vacaciones_estado").using("btree", table.estado.asc().nullsLast().op("text_ops")),
	index("idx_vacaciones_fechas").using("btree", table.fecha_inicio.asc().nullsLast().op("date_ops"), table.fecha_fin.asc().nullsLast().op("date_ops")),
	index("idx_vacaciones_personal_id").using("btree", table.personal_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.personal_id],
			foreignColumns: [personal.id],
			name: "personal_vacaciones_personal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.aprobado_por_id],
			foreignColumns: [usuarios.id],
			name: "personal_vacaciones_aprobado_por_id_fkey"
		}).onDelete("set null"),
	check("personal_vacaciones_dias_solicitados_check", sql`dias_solicitados > 0`),
	check("check_vacaciones_fechas", sql`fecha_fin >= fecha_inicio`),
]);

export const personalAsistencia = pgTable("personal_asistencia", {
	id: serial().primaryKey().notNull(),
	personal_id: integer("personal_id").notNull(),
	fecha: date().notNull(),
	hora_entrada: time("hora_entrada"),
	hora_salida: time("hora_salida"),
	minutos_tardanza: integer("minutos_tardanza").default(0).notNull(),
	estado: varchar({ length: 40 }).default('PRESENTE').notNull(),
	justificacion: text(),
	sede_id: integer("sede_id"),
	usuario_registro_id: integer("usuario_registro_id"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_asistencia_estado").using("btree", table.estado.asc().nullsLast().op("text_ops")),
	index("idx_asistencia_fecha").using("btree", table.fecha.asc().nullsLast().op("date_ops")),
	index("idx_asistencia_personal_id").using("btree", table.personal_id.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.personal_id],
			foreignColumns: [personal.id],
			name: "personal_asistencia_personal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sede_id],
			foreignColumns: [sedes.id],
			name: "personal_asistencia_sede_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.usuario_registro_id],
			foreignColumns: [usuarios.id],
			name: "personal_asistencia_usuario_registro_id_fkey"
		}).onDelete("set null"),
	unique("uq_personal_fecha").on(table.fecha, table.personal_id),
]);

export const personalDocumentos = pgTable("personal_documentos", {
	id: serial().primaryKey().notNull(),
	personal_id: integer("personal_id").notNull(),
	tipo_documento: varchar("tipo_documento", { length: 50 }).notNull(),
	codigo_emision: varchar("codigo_emision", { length: 50 }).notNull(),
	fecha_emision: date("fecha_emision").default(sql`CURRENT_DATE`).notNull(),
	destinatario: varchar({ length: 200 }).default('A quien corresponda'),
	cargo_consignado: varchar("cargo_consignado", { length: 100 }),
	remuneracion_consignada: numeric("remuneracion_consignada", { precision: 10, scale:  2 }),
	archivo_url: text("archivo_url"),
	observaciones: text(),
	emitido_por_id: integer("emitido_por_id"),
	contenido_renderizado: text("contenido_renderizado"),
	plantilla_id: integer("plantilla_id"),
	firmante_nombre: varchar("firmante_nombre", { length: 150 }),
	firmante_cargo: varchar("firmante_cargo", { length: 150 }),
	firmante_firma_url: text("firmante_firma_url"),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_documentos_codigo").using("btree", table.codigo_emision.asc().nullsLast().op("text_ops")),
	index("idx_documentos_personal_id").using("btree", table.personal_id.asc().nullsLast().op("int4_ops")),
	index("idx_documentos_tipo").using("btree", table.tipo_documento.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.personal_id],
			foreignColumns: [personal.id],
			name: "personal_documentos_personal_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.emitido_por_id],
			foreignColumns: [usuarios.id],
			name: "personal_documentos_emitido_por_id_fkey"
		}).onDelete("set null"),
	unique("personal_documentos_codigo_emision_key").on(table.codigo_emision),
]);

export const personalPlantillasDocumentos = pgTable("personal_plantillas_documentos", {
	id: serial().primaryKey().notNull(),
	tipo_documento: varchar("tipo_documento", { length: 50 }).notNull(),
	nombre: varchar("nombre", { length: 150 }).notNull(),
	titulo_documento: varchar("titulo_documento", { length: 150 }).notNull(),
	cuerpo_template: text("cuerpo_template").notNull(),
	parrafo_cierre: text("parrafo_cierre"),
	ciudad_defecto: varchar("ciudad_defecto", { length: 100 }).default('LIMA'),
	mostrar_logo: boolean("mostrar_logo").default(true),
	firmante_nombre: varchar("firmante_nombre", { length: 150 }),
	firmante_cargo: varchar("firmante_cargo", { length: 150 }),
	firmante_firma_url: text("firmante_firma_url"),
	activo: boolean("activo").default(true),
	created_at: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updated_at: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("personal_plantillas_documentos_tipo_documento_key").on(table.tipo_documento),
]);
