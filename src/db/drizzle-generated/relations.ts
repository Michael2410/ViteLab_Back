import { relations } from "drizzle-orm/relations";
import { roles, usuarios, personal, rolesPermisos, permisos, tarifarios, convenios, tarifarioPrecios, analisis, areas, componentes, metodos, ordenAnalisis, resultados, componenteMuestras, muestras, ordenes, usuariosSedes, sedes, pacientes, tiposCliente, personalSedes, whatsappMessagesLog, personalContratos, personalTiposContrato, personalCargos, personalAreas, personalMotivosCese, personalHistorialLaboral, personalVacaciones, personalAsistencia, personalDocumentos } from "./schema";

export const usuariosRelations = relations(usuarios, ({one, many}) => ({
	role: one(roles, {
		fields: [usuarios.rol_id],
		references: [roles.id]
	}),
	personal: one(personal, {
		fields: [usuarios.personal_id],
		references: [personal.id]
	}),
	resultados: many(resultados),
	usuariosSedes: many(usuariosSedes),
	ordenes_usuarioRegistroId: many(ordenes, {
		relationName: "ordenes_usuarioRegistroId_usuarios_id"
	}),
	ordenes_usuarioAprobacionId: many(ordenes, {
		relationName: "ordenes_usuarioAprobacionId_usuarios_id"
	}),
	ordenes_usuarioRecepcionId: many(ordenes, {
		relationName: "ordenes_usuarioRecepcionId_usuarios_id"
	}),
	whatsappMessagesLogs: many(whatsappMessagesLog),
	personalContratos: many(personalContratos),
	personalHistorialLaborals: many(personalHistorialLaboral),
	personalVacaciones: many(personalVacaciones),
	personalAsistencias: many(personalAsistencia),
	personalDocumentos: many(personalDocumentos),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	usuarios: many(usuarios),
	rolesPermisos: many(rolesPermisos),
}));

export const personalRelations = relations(personal, ({one, many}) => ({
	usuarios: many(usuarios),
	personalSedes: many(personalSedes),
	personalContratos: many(personalContratos),
	personalCargo: one(personalCargos, {
		fields: [personal.cargo_id],
		references: [personalCargos.id]
	}),
	personalArea: one(personalAreas, {
		fields: [personal.area_id],
		references: [personalAreas.id]
	}),
	personalTiposContrato: one(personalTiposContrato, {
		fields: [personal.tipo_contrato_id],
		references: [personalTiposContrato.id]
	}),
	personalMotivosCese: one(personalMotivosCese, {
		fields: [personal.motivo_cese_id],
		references: [personalMotivosCese.id]
	}),
	personalHistorialLaborals: many(personalHistorialLaboral),
	personalVacaciones: many(personalVacaciones),
	personalAsistencias: many(personalAsistencia),
	personalDocumentos: many(personalDocumentos),
}));

export const rolesPermisosRelations = relations(rolesPermisos, ({one}) => ({
	role: one(roles, {
		fields: [rolesPermisos.rol_id],
		references: [roles.id]
	}),
	permiso: one(permisos, {
		fields: [rolesPermisos.permiso_id],
		references: [permisos.id]
	}),
}));

export const permisosRelations = relations(permisos, ({many}) => ({
	rolesPermisos: many(rolesPermisos),
}));

export const conveniosRelations = relations(convenios, ({one, many}) => ({
	tarifario: one(tarifarios, {
		fields: [convenios.tarifario_id],
		references: [tarifarios.id]
	}),
	ordenes: many(ordenes),
}));

export const tarifariosRelations = relations(tarifarios, ({many}) => ({
	convenios: many(convenios),
	tarifarioPrecios: many(tarifarioPrecios),
}));

export const tarifarioPreciosRelations = relations(tarifarioPrecios, ({one}) => ({
	tarifario: one(tarifarios, {
		fields: [tarifarioPrecios.tarifario_id],
		references: [tarifarios.id]
	}),
	analisi: one(analisis, {
		fields: [tarifarioPrecios.analisis_id],
		references: [analisis.id]
	}),
}));

export const analisisRelations = relations(analisis, ({many}) => ({
	tarifarioPrecios: many(tarifarioPrecios),
	ordenAnalises: many(ordenAnalisis),
}));

export const componentesRelations = relations(componentes, ({one, many}) => ({
	area: one(areas, {
		fields: [componentes.area_id],
		references: [areas.id]
	}),
	metodo: one(metodos, {
		fields: [componentes.metodo_id],
		references: [metodos.id]
	}),
	resultados: many(resultados),
	componenteMuestras: many(componenteMuestras),
}));

export const areasRelations = relations(areas, ({many}) => ({
	componentes: many(componentes),
}));

export const metodosRelations = relations(metodos, ({many}) => ({
	componentes: many(componentes),
}));

export const resultadosRelations = relations(resultados, ({one}) => ({
	ordenAnalisi: one(ordenAnalisis, {
		fields: [resultados.orden_analisis_id],
		references: [ordenAnalisis.id]
	}),
	componente: one(componentes, {
		fields: [resultados.componente_id],
		references: [componentes.id]
	}),
	usuario: one(usuarios, {
		fields: [resultados.usuario_registro_id],
		references: [usuarios.id]
	}),
}));

export const ordenAnalisisRelations = relations(ordenAnalisis, ({one, many}) => ({
	resultados: many(resultados),
	ordene: one(ordenes, {
		fields: [ordenAnalisis.orden_id],
		references: [ordenes.id]
	}),
	analisi: one(analisis, {
		fields: [ordenAnalisis.analisis_id],
		references: [analisis.id]
	}),
}));

export const componenteMuestrasRelations = relations(componenteMuestras, ({one}) => ({
	componente: one(componentes, {
		fields: [componenteMuestras.componente_id],
		references: [componentes.id]
	}),
	muestra: one(muestras, {
		fields: [componenteMuestras.muestra_id],
		references: [muestras.id]
	}),
}));

export const muestrasRelations = relations(muestras, ({many}) => ({
	componenteMuestras: many(componenteMuestras),
}));

export const ordenesRelations = relations(ordenes, ({one, many}) => ({
	ordenAnalises: many(ordenAnalisis),
	paciente: one(pacientes, {
		fields: [ordenes.paciente_id],
		references: [pacientes.id]
	}),
	sede: one(sedes, {
		fields: [ordenes.sede_id],
		references: [sedes.id]
	}),
	tiposCliente: one(tiposCliente, {
		fields: [ordenes.tipo_cliente_id],
		references: [tiposCliente.id]
	}),
	convenio: one(convenios, {
		fields: [ordenes.convenio_id],
		references: [convenios.id]
	}),
	usuario_usuarioRegistroId: one(usuarios, {
		fields: [ordenes.usuario_registro_id],
		references: [usuarios.id],
		relationName: "ordenes_usuarioRegistroId_usuarios_id"
	}),
	usuario_usuarioAprobacionId: one(usuarios, {
		fields: [ordenes.usuario_aprobacion_id],
		references: [usuarios.id],
		relationName: "ordenes_usuarioAprobacionId_usuarios_id"
	}),
	usuario_usuarioRecepcionId: one(usuarios, {
		fields: [ordenes.usuario_recepcion_id],
		references: [usuarios.id],
		relationName: "ordenes_usuarioRecepcionId_usuarios_id"
	}),
	whatsappMessagesLogs: many(whatsappMessagesLog),
}));

export const usuariosSedesRelations = relations(usuariosSedes, ({one}) => ({
	usuario: one(usuarios, {
		fields: [usuariosSedes.usuario_id],
		references: [usuarios.id]
	}),
	sede: one(sedes, {
		fields: [usuariosSedes.sede_id],
		references: [sedes.id]
	}),
}));

export const sedesRelations = relations(sedes, ({many}) => ({
	usuariosSedes: many(usuariosSedes),
	ordenes: many(ordenes),
	personalSedes: many(personalSedes),
	personalAsistencias: many(personalAsistencia),
}));

export const pacientesRelations = relations(pacientes, ({many}) => ({
	ordenes: many(ordenes),
}));

export const tiposClienteRelations = relations(tiposCliente, ({many}) => ({
	ordenes: many(ordenes),
}));

export const personalSedesRelations = relations(personalSedes, ({one}) => ({
	personal: one(personal, {
		fields: [personalSedes.personal_id],
		references: [personal.id]
	}),
	sede: one(sedes, {
		fields: [personalSedes.sede_id],
		references: [sedes.id]
	}),
}));

export const whatsappMessagesLogRelations = relations(whatsappMessagesLog, ({one}) => ({
	ordene: one(ordenes, {
		fields: [whatsappMessagesLog.orden_id],
		references: [ordenes.id]
	}),
	usuario: one(usuarios, {
		fields: [whatsappMessagesLog.sent_by],
		references: [usuarios.id]
	}),
}));

export const personalContratosRelations = relations(personalContratos, ({one}) => ({
	personal: one(personal, {
		fields: [personalContratos.personal_id],
		references: [personal.id]
	}),
	personalTiposContrato: one(personalTiposContrato, {
		fields: [personalContratos.tipo_contrato_id],
		references: [personalTiposContrato.id]
	}),
	usuario: one(usuarios, {
		fields: [personalContratos.usuario_registro_id],
		references: [usuarios.id]
	}),
}));

export const personalTiposContratoRelations = relations(personalTiposContrato, ({many}) => ({
	personalContratos: many(personalContratos),
	personals: many(personal),
}));

export const personalCargosRelations = relations(personalCargos, ({many}) => ({
	personals: many(personal),
}));

export const personalAreasRelations = relations(personalAreas, ({many}) => ({
	personals: many(personal),
}));

export const personalMotivosCeseRelations = relations(personalMotivosCese, ({many}) => ({
	personals: many(personal),
	personalHistorialLaborals: many(personalHistorialLaboral),
}));

export const personalHistorialLaboralRelations = relations(personalHistorialLaboral, ({one}) => ({
	personal: one(personal, {
		fields: [personalHistorialLaboral.personal_id],
		references: [personal.id]
	}),
	personalMotivosCese: one(personalMotivosCese, {
		fields: [personalHistorialLaboral.motivo_cese_id],
		references: [personalMotivosCese.id]
	}),
	usuario: one(usuarios, {
		fields: [personalHistorialLaboral.usuario_id],
		references: [usuarios.id]
	}),
}));

export const personalVacacionesRelations = relations(personalVacaciones, ({one}) => ({
	personal: one(personal, {
		fields: [personalVacaciones.personal_id],
		references: [personal.id]
	}),
	usuario: one(usuarios, {
		fields: [personalVacaciones.aprobado_por_id],
		references: [usuarios.id]
	}),
}));

export const personalAsistenciaRelations = relations(personalAsistencia, ({one}) => ({
	personal: one(personal, {
		fields: [personalAsistencia.personal_id],
		references: [personal.id]
	}),
	sede: one(sedes, {
		fields: [personalAsistencia.sede_id],
		references: [sedes.id]
	}),
	usuario: one(usuarios, {
		fields: [personalAsistencia.usuario_registro_id],
		references: [usuarios.id]
	}),
}));

export const personalDocumentosRelations = relations(personalDocumentos, ({one}) => ({
	personal: one(personal, {
		fields: [personalDocumentos.personal_id],
		references: [personal.id]
	}),
	usuario: one(usuarios, {
		fields: [personalDocumentos.emitido_por_id],
		references: [usuarios.id]
	}),
}));