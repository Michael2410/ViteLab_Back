-- ============================================================================
-- Migración 023: Actualización y Organización Integral de Permisos de RRHH
-- Módulo: personal
-- Submódulos: directorio, cuenta, contratos, vacaciones, asistencia, documentos, catalogos, historial
-- ============================================================================

-- 1. Insertar o actualizar la matriz completa de permisos del módulo personal
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
-- Directorio
('personal', 'directorio', 'read', 'personal.directorio.read', 'Ver directorio y fichas de personal'),
('personal', 'directorio', 'create', 'personal.directorio.create', 'Registrar nuevo personal'),
('personal', 'directorio', 'update', 'personal.directorio.update', 'Editar datos de personal, altas y ceses'),
('personal', 'directorio', 'delete', 'personal.directorio.delete', 'Desactivar o eliminar colaborador'),

-- Cuenta de acceso
('personal', 'cuenta', 'create', 'personal.cuenta.create', 'Crear y vincular usuario de sistema para personal'),
('personal', 'cuenta', 'update', 'personal.cuenta.update', 'Editar credenciales o rol de sistema de personal'),
('personal', 'cuenta', 'delete', 'personal.cuenta.delete', 'Desvincular o revocar acceso de sistema'),

-- Contratos
('personal', 'contratos', 'read', 'personal.contratos.read', 'Ver contratos y alertas preventivas de vencimiento'),
('personal', 'contratos', 'create', 'personal.contratos.create', 'Registrar nuevos contratos laborales'),
('personal', 'contratos', 'update', 'personal.contratos.update', 'Editar y renovar contratos laborales'),
('personal', 'contratos', 'delete', 'personal.contratos.delete', 'Eliminar contratos laborales'),

-- Vacaciones
('personal', 'vacaciones', 'read', 'personal.vacaciones.read', 'Ver solicitudes, saldos y calendario mensual de vacaciones'),
('personal', 'vacaciones', 'create', 'personal.vacaciones.create', 'Registrar y programar solicitudes vacacionales'),
('personal', 'vacaciones', 'approve', 'personal.vacaciones.approve', 'Aprobar o rechazar solicitudes de vacaciones'),
('personal', 'vacaciones', 'delete', 'personal.vacaciones.delete', 'Eliminar o anular solicitudes vacacionales'),

-- Asistencia & Control Horario
('personal', 'asistencia', 'read', 'personal.asistencia.read', 'Ver registros de asistencia diaria, tardanzas y faltas'),
('personal', 'asistencia', 'create', 'personal.asistencia.create', 'Registrar entradas, salidas y justificaciones de asistencia'),
('personal', 'asistencia', 'update', 'personal.asistencia.update', 'Editar y rectificar marcas de asistencia, horarios y justificaciones'),
('personal', 'asistencia', 'delete', 'personal.asistencia.delete', 'Eliminar registros de asistencia'),

-- Documentos & Certificados Laborales
('personal', 'documentos', 'read', 'personal.documentos.read', 'Ver documentos y constancias emitidas'),
('personal', 'documentos', 'create', 'personal.documentos.create', 'Generar constancias de trabajo y certificados laborales'),
('personal', 'documentos', 'delete', 'personal.documentos.delete', 'Eliminar registros de documentos emitidos'),

-- Catálogos Configurables (Cargos, Áreas, Tipos Contrato, Motivos Cese)
('personal', 'catalogos', 'read', 'personal.catalogos.read', 'Ver catálogos de cargos, áreas y contratos de personal'),
('personal', 'catalogos', 'manage', 'personal.catalogos.manage', 'Crear, editar y eliminar catálogos de personal'),

-- Historial Laboral
('personal', 'historial', 'read', 'personal.historial.read', 'Ver línea de tiempo e historial de eventos laborales'),
('personal', 'historial', 'create', 'personal.historial.create', 'Registrar eventos manuales en el historial laboral')
ON CONFLICT (codigo) DO UPDATE SET
  modulo = EXCLUDED.modulo,
  submodulo = EXCLUDED.submodulo,
  accion = EXCLUDED.accion,
  descripcion = EXCLUDED.descripcion;

-- 2. Asignar todos los permisos del módulo personal al rol SUPER_ADMIN (rol_id = 1)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos
WHERE modulo = 'personal'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- 3. Asignar todos los permisos del módulo personal al rol ADMIN (rol_id = 2)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos
WHERE modulo = 'personal'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
