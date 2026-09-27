-- =======================================================
-- SCRIPT 018: CATÁLOGOS DINÁMICOS PARA PERSONAL (RRHH)
-- Descripción:
--   1. Crear tablas: personal_cargos, personal_areas, personal_tipos_contrato
--   2. Poblar catálogos iniciales con los valores históricos
--   3. Agregar columnas cargo_id, area_id, tipo_contrato_id a la tabla personal
--   4. Mapear/vincular registros de personal existentes a sus IDs correspondientes
--   5. Registrar permisos para administración de catálogos
-- =======================================================

-- 1. TABLA: personal_cargos
CREATE TABLE IF NOT EXISTS personal_cargos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_personal_cargos_activo ON personal_cargos(activo);

-- 2. TABLA: personal_areas
CREATE TABLE IF NOT EXISTS personal_areas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_personal_areas_activo ON personal_areas(activo);

-- 3. TABLA: personal_tipos_contrato
CREATE TABLE IF NOT EXISTS personal_tipos_contrato (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_personal_tipos_contrato_activo ON personal_tipos_contrato(activo);

-- 4. POBLAR DATOS INICIALES (SEMILLAS)

-- Cargos
INSERT INTO personal_cargos (nombre, descripcion) VALUES
('Biólogo', 'Profesional responsable de análisis y validación técnica'),
('Técnico de Laboratorio', 'Técnico encargado del procesamiento y toma de muestras'),
('Recepcionista', 'Atención al paciente y admisión de órdenes'),
('Jefe de Área', 'Supervisión técnica y operativa de sección'),
('Administrador', 'Gestión administrativa y operativa general'),
('Almacenero', 'Control de stock, reactivos y suministros'),
('Médico Patólogo', 'Interconsulta médica y emisión de diagnósticos'),
('Auxiliar de Muestras', 'Apoyo en recepción y preparación de muestras'),
('Otro', 'Otras funciones o cargos')
ON CONFLICT (nombre) DO UPDATE SET activo = true;

-- Áreas
INSERT INTO personal_areas (nombre, descripcion) VALUES
('Laboratorio', 'Área de procesamiento técnico y análisis clínico'),
('Almacén & Logística', 'Gestión de inventarios, insumos y compras'),
('Administración', 'Gestión contable, RRHH y gerencial'),
('Recepción & Caja', 'Atención al usuario y cobro de servicios'),
('Dirección Médica', 'Supervisión y auditoría médica'),
('Sistemas & TI', 'Soporte tecnológico e infraestructura')
ON CONFLICT (nombre) DO UPDATE SET activo = true;

-- Tipos de Contrato
INSERT INTO personal_tipos_contrato (nombre, descripcion) VALUES
('Planilla (Indefinido)', 'Régimen laboral a tiempo indeterminado'),
('Planilla (Plazo Fijo)', 'Régimen sujeto a modalidad con término'),
('Locación de Servicios (RxH)', 'Prestación de servicios independientes por recibo por honorarios'),
('Prácticas Pre-Profesionales', 'Convenio de formación laboral estudiantil'),
('Prácticas Profesionales', 'Convenio de prácticas para egresados')
ON CONFLICT (nombre) DO UPDATE SET activo = true;

-- 5. AGREGAR COLUMNAS DE CLAVE FORÁNEA A PERSONAL
ALTER TABLE personal ADD COLUMN IF NOT EXISTS cargo_id INTEGER REFERENCES personal_cargos(id) ON DELETE SET NULL;
ALTER TABLE personal ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES personal_areas(id) ON DELETE SET NULL;
ALTER TABLE personal ADD COLUMN IF NOT EXISTS tipo_contrato_id INTEGER REFERENCES personal_tipos_contrato(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_cargo_id ON personal(cargo_id);
CREATE INDEX IF NOT EXISTS idx_personal_area_id ON personal(area_id);
CREATE INDEX IF NOT EXISTS idx_personal_tipo_contrato_id ON personal(tipo_contrato_id);

-- 6. MIGRAR / VINCULAR REGISTROS DE PERSONAL EXISTENTES
UPDATE personal p
SET cargo_id = c.id
FROM personal_cargos c
WHERE TRIM(LOWER(p.cargo)) = TRIM(LOWER(c.nombre)) AND p.cargo_id IS NULL;

UPDATE personal p
SET area_id = a.id
FROM personal_areas a
WHERE TRIM(LOWER(p.area)) = TRIM(LOWER(a.nombre)) AND p.area_id IS NULL;

UPDATE personal p
SET tipo_contrato_id = tc.id
FROM personal_tipos_contrato tc
WHERE TRIM(LOWER(p.tipo_contrato)) = TRIM(LOWER(tc.nombre)) AND p.tipo_contrato_id IS NULL;

-- 7. INSERTAR PERMISOS DE CATÁLOGOS DE PERSONAL
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
('personal', 'catalogos', 'read', 'personal.catalogos.read', 'Ver catálogos de cargos, áreas y contratos de personal'),
('personal', 'catalogos', 'manage', 'personal.catalogos.manage', 'Crear, editar y eliminar catálogos de personal')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar nuevos permisos al rol SUPER_ADMIN (rol_id = 1)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos 
WHERE modulo = 'personal' AND submodulo = 'catalogos'
AND id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 1)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignar nuevos permisos al rol ADMIN (rol_id = 2)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos 
WHERE modulo = 'personal' AND submodulo = 'catalogos'
AND id NOT IN (SELECT permiso_id FROM roles_permisos WHERE rol_id = 2)
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
