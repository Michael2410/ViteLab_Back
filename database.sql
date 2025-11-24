-- ============================================
-- SISTEMA DE LABORATORIO CLÍNICO (LIMS)
-- Base de datos PostgreSQL
-- Versión 1.0
-- ============================================

-- Crear base de datos
CREATE DATABASE vitelab_db;

-- Conectar a la base de datos
\c vitelab_db;

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLAS DE CONFIGURACIÓN Y CATÁLOGOS
-- ============================================

-- Tabla: Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Permisos
CREATE TABLE permisos (
    id SERIAL PRIMARY KEY,
    modulo VARCHAR(50) NOT NULL, -- auth, orders, results, catalogs, tariffs, settings
    submodulo VARCHAR(50), -- users, roles, analysis, components, etc.
    accion VARCHAR(50) NOT NULL, -- create, read, update, delete, approve, print
    codigo VARCHAR(100) NOT NULL UNIQUE, -- orders.create, orders.approve, results.read
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Relación Roles-Permisos (muchos a muchos)
CREATE TABLE roles_permisos (
    id SERIAL PRIMARY KEY,
    rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permiso_id INTEGER NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rol_id, permiso_id)
);

-- Tabla: Usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    rol_id INTEGER NOT NULL REFERENCES roles(id),
    firma_url TEXT, -- URL de imagen de firma
    activo BOOLEAN DEFAULT true,
    refresh_token TEXT,
    refresh_token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Sedes
CREATE TABLE sedes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    direccion TEXT,
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Tipos de Cliente
CREATE TABLE tipos_cliente (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE, -- Particular, Convenio
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Tarifarios
CREATE TABLE tarifarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Convenios
CREATE TABLE convenios (
    id SERIAL PRIMARY KEY,
    nombre_empresa VARCHAR(200) NOT NULL,
    ruc VARCHAR(11) NOT NULL UNIQUE,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(100),
    tarifario_id INTEGER REFERENCES tarifarios(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Áreas
CREATE TABLE areas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Métodos
CREATE TABLE metodos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLAS DE ANÁLISIS Y COMPONENTES
-- ============================================

-- Tabla: Análisis
CREATE TABLE analisis (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    sinonimia TEXT[], -- Array de sinónimos para búsqueda
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Componentes (subtítulos de un análisis)
CREATE TABLE componentes (
    id SERIAL PRIMARY KEY,
    analisis_id INTEGER NOT NULL REFERENCES analisis(id) ON DELETE CASCADE,
    nombre VARCHAR(200) NOT NULL,
    valor_referencial VARCHAR(200), -- Puede ser rango, texto, etc.
    unidad_medida VARCHAR(50),
    area_id INTEGER REFERENCES areas(id),
    metodo_id INTEGER REFERENCES metodos(id),
    orden INTEGER DEFAULT 0, -- Para ordenar componentes dentro del análisis
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Precios por Tarifario (relación Tarifario-Análisis)
CREATE TABLE tarifario_precios (
    id SERIAL PRIMARY KEY,
    tarifario_id INTEGER NOT NULL REFERENCES tarifarios(id) ON DELETE CASCADE,
    analisis_id INTEGER NOT NULL REFERENCES analisis(id) ON DELETE CASCADE,
    precio DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tarifario_id, analisis_id)
);

-- ============================================
-- TABLAS DE PACIENTES Y ÓRDENES
-- ============================================

-- Tabla: Pacientes (se guardan al crear orden desde API)
CREATE TABLE pacientes (
    id SERIAL PRIMARY KEY,
    dni VARCHAR(20) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100) NOT NULL,
    nombre_completo VARCHAR(300) NOT NULL,
    fecha_nacimiento DATE,
    genero CHAR(1), -- M, F
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Órdenes de Atención
CREATE TABLE ordenes (
    id SERIAL PRIMARY KEY,
    numero_atencion INTEGER NOT NULL UNIQUE, -- Incremental: 1, 2, 3...
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
    sede_id INTEGER NOT NULL REFERENCES sedes(id),
    tipo_cliente_id INTEGER NOT NULL REFERENCES tipos_cliente(id),
    convenio_id INTEGER REFERENCES convenios(id), -- NULL si es particular
    usuario_registro_id INTEGER NOT NULL REFERENCES usuarios(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'REGISTRADA', -- REGISTRADA, CON_RESULTADOS, APROBADA
    nota TEXT, -- Nota opcional
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion TIMESTAMP,
    usuario_aprobacion_id INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: Detalle de Orden - Análisis solicitados (muchos a muchos)
CREATE TABLE orden_analisis (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    analisis_id INTEGER NOT NULL REFERENCES analisis(id),
    precio DECIMAL(10, 2) NOT NULL, -- Precio al momento de la orden
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLAS DE RESULTADOS
-- ============================================

-- Tabla: Resultados por Componente
CREATE TABLE resultados (
    id SERIAL PRIMARY KEY,
    orden_analisis_id INTEGER NOT NULL REFERENCES orden_analisis(id) ON DELETE CASCADE,
    componente_id INTEGER NOT NULL REFERENCES componentes(id),
    resultado TEXT, -- Valor ingresado
    valor_referencial VARCHAR(200), -- Puede ser diferente al predefinido
    observacion TEXT,
    usuario_registro_id INTEGER REFERENCES usuarios(id),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(orden_analisis_id, componente_id)
);

-- ============================================
-- TABLA DE CONFIGURACIÓN GENERAL DEL SISTEMA
-- ============================================

CREATE TABLE configuracion_sistema (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) NOT NULL UNIQUE, -- logo_url, nombre_empresa, ruc_empresa, etc.
    valor TEXT,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Usuarios
CREATE INDEX idx_usuarios_username ON usuarios(username);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol_id ON usuarios(rol_id);

-- Permisos
CREATE INDEX idx_permisos_modulo ON permisos(modulo);
CREATE INDEX idx_permisos_codigo ON permisos(codigo);

-- Roles-Permisos
CREATE INDEX idx_roles_permisos_rol ON roles_permisos(rol_id);
CREATE INDEX idx_roles_permisos_permiso ON roles_permisos(permiso_id);

-- Análisis
CREATE INDEX idx_analisis_nombre ON analisis(nombre);
CREATE INDEX idx_analisis_sinonimia ON analisis USING GIN(sinonimia);

-- Componentes
CREATE INDEX idx_componentes_analisis_id ON componentes(analisis_id);

-- Pacientes
CREATE INDEX idx_pacientes_dni ON pacientes(dni);
CREATE INDEX idx_pacientes_nombre_completo ON pacientes(nombre_completo);

-- Órdenes
CREATE INDEX idx_ordenes_numero_atencion ON ordenes(numero_atencion);
CREATE INDEX idx_ordenes_paciente_id ON ordenes(paciente_id);
CREATE INDEX idx_ordenes_estado ON ordenes(estado);
CREATE INDEX idx_ordenes_fecha_registro ON ordenes(fecha_registro);

-- Orden Análisis
CREATE INDEX idx_orden_analisis_orden_id ON orden_analisis(orden_id);
CREATE INDEX idx_orden_analisis_analisis_id ON orden_analisis(analisis_id);

-- Resultados
CREATE INDEX idx_resultados_orden_analisis_id ON resultados(orden_analisis_id);
CREATE INDEX idx_resultados_componente_id ON resultados(componente_id);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a tablas con updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sedes_updated_at BEFORE UPDATE ON sedes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tipos_cliente_updated_at BEFORE UPDATE ON tipos_cliente FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tarifarios_updated_at BEFORE UPDATE ON tarifarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_convenios_updated_at BEFORE UPDATE ON convenios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_metodos_updated_at BEFORE UPDATE ON metodos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analisis_updated_at BEFORE UPDATE ON analisis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_componentes_updated_at BEFORE UPDATE ON componentes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tarifario_precios_updated_at BEFORE UPDATE ON tarifario_precios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON pacientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ordenes_updated_at BEFORE UPDATE ON ordenes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resultados_updated_at BEFORE UPDATE ON resultados FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_configuracion_sistema_updated_at BEFORE UPDATE ON configuracion_sistema FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DATOS INICIALES (SEEDS)
-- ============================================

-- Roles iniciales
INSERT INTO roles (nombre, descripcion) VALUES
('SUPER_ADMIN', 'Acceso total al sistema'),
('ADMIN', 'Administrador con permisos amplios'),
('LABORATORISTA', 'Registra resultados de análisis'),
('RECEPCIONISTA', 'Registra órdenes de atención'),
('VISUALIZADOR', 'Solo visualiza información');

-- Permisos por módulo y acción
INSERT INTO permisos (modulo, submodulo, accion, codigo, descripcion) VALUES
-- AUTH
('auth', 'users', 'create', 'auth.users.create', 'Crear usuarios'),
('auth', 'users', 'read', 'auth.users.read', 'Ver usuarios'),
('auth', 'users', 'update', 'auth.users.update', 'Editar usuarios'),
('auth', 'users', 'delete', 'auth.users.delete', 'Eliminar usuarios'),
('auth', 'roles', 'create', 'auth.roles.create', 'Crear roles'),
('auth', 'roles', 'read', 'auth.roles.read', 'Ver roles'),
('auth', 'roles', 'update', 'auth.roles.update', 'Editar roles'),
('auth', 'roles', 'delete', 'auth.roles.delete', 'Eliminar roles'),

-- ORDERS
('orders', NULL, 'create', 'orders.create', 'Crear órdenes'),
('orders', NULL, 'read', 'orders.read', 'Ver órdenes'),
('orders', NULL, 'update', 'orders.update', 'Editar órdenes'),
('orders', NULL, 'delete', 'orders.delete', 'Eliminar órdenes'),
('orders', NULL, 'print', 'orders.print', 'Imprimir PDF de órdenes'),

-- RESULTS
('results', NULL, 'create', 'results.create', 'Ingresar resultados'),
('results', NULL, 'read', 'results.read', 'Ver resultados'),
('results', NULL, 'update', 'results.update', 'Editar resultados'),
('results', NULL, 'approve', 'results.approve', 'Aprobar resultados'),
('results', NULL, 'print', 'results.print', 'Imprimir PDF de resultados'),

-- CATALOGS - ANALYSIS
('catalogs', 'analysis', 'create', 'catalogs.analysis.create', 'Crear análisis'),
('catalogs', 'analysis', 'read', 'catalogs.analysis.read', 'Ver análisis'),
('catalogs', 'analysis', 'update', 'catalogs.analysis.update', 'Editar análisis'),
('catalogs', 'analysis', 'delete', 'catalogs.analysis.delete', 'Eliminar análisis'),

-- CATALOGS - COMPONENTS
('catalogs', 'components', 'create', 'catalogs.components.create', 'Crear componentes'),
('catalogs', 'components', 'read', 'catalogs.components.read', 'Ver componentes'),
('catalogs', 'components', 'update', 'catalogs.components.update', 'Editar componentes'),
('catalogs', 'components', 'delete', 'catalogs.components.delete', 'Eliminar componentes'),

-- CATALOGS - AREAS
('catalogs', 'areas', 'create', 'catalogs.areas.create', 'Crear áreas'),
('catalogs', 'areas', 'read', 'catalogs.areas.read', 'Ver áreas'),
('catalogs', 'areas', 'update', 'catalogs.areas.update', 'Editar áreas'),
('catalogs', 'areas', 'delete', 'catalogs.areas.delete', 'Eliminar áreas'),

-- CATALOGS - METHODS
('catalogs', 'methods', 'create', 'catalogs.methods.create', 'Crear métodos'),
('catalogs', 'methods', 'read', 'catalogs.methods.read', 'Ver métodos'),
('catalogs', 'methods', 'update', 'catalogs.methods.update', 'Editar métodos'),
('catalogs', 'methods', 'delete', 'catalogs.methods.delete', 'Eliminar métodos'),

-- CATALOGS - CONVENIOS
('catalogs', 'convenios', 'create', 'catalogs.convenios.create', 'Crear convenios'),
('catalogs', 'convenios', 'read', 'catalogs.convenios.read', 'Ver convenios'),
('catalogs', 'convenios', 'update', 'catalogs.convenios.update', 'Editar convenios'),
('catalogs', 'convenios', 'delete', 'catalogs.convenios.delete', 'Eliminar convenios'),

-- CATALOGS - SEDES
('catalogs', 'sedes', 'create', 'catalogs.sedes.create', 'Crear sedes'),
('catalogs', 'sedes', 'read', 'catalogs.sedes.read', 'Ver sedes'),
('catalogs', 'sedes', 'update', 'catalogs.sedes.update', 'Editar sedes'),
('catalogs', 'sedes', 'delete', 'catalogs.sedes.delete', 'Eliminar sedes'),

-- TARIFFS
('tariffs', NULL, 'create', 'tariffs.create', 'Crear tarifarios'),
('tariffs', NULL, 'read', 'tariffs.read', 'Ver tarifarios'),
('tariffs', NULL, 'update', 'tariffs.update', 'Editar tarifarios'),
('tariffs', NULL, 'delete', 'tariffs.delete', 'Eliminar tarifarios'),

-- SETTINGS
('settings', NULL, 'read', 'settings.read', 'Ver configuración'),
('settings', NULL, 'update', 'settings.update', 'Editar configuración');

-- Asignar TODOS los permisos al rol SUPER_ADMIN
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos;

-- Asignar permisos específicos a ADMIN (todos menos gestión de roles)
INSERT INTO roles_permisos (rol_id, permiso_id)
SELECT 2, id FROM permisos WHERE codigo NOT LIKE 'auth.roles%';

-- Usuario administrador inicial (password: admin123)
-- Hash generado con bcrypt: $2b$10$...
INSERT INTO usuarios (username, email, password_hash, nombres, apellidos, rol_id) VALUES
('admin', 'admin@vitelab.com', '$2b$10$YQjZwqX5X0X4X0X4X0X4XOqF7JX9X0X4X0X4X0X4X0X4X0X4X0X4X', 'Administrador', 'Sistema', 1);

-- Tipos de cliente iniciales
INSERT INTO tipos_cliente (nombre) VALUES
('Particular'),
('Convenio');

-- Sede inicial
INSERT INTO sedes (nombre, direccion, telefono) VALUES
('Sede Central', 'Av. Principal 123', '01-234567');

-- Áreas iniciales
INSERT INTO areas (nombre, descripcion) VALUES
('Hematología', 'Estudios de sangre'),
('Bioquímica', 'Análisis bioquímicos'),
('Inmunología', 'Estudios inmunológicos'),
('Microbiología', 'Estudios microbiológicos'),
('Hormonales', 'Análisis de hormonas');

-- Métodos iniciales
INSERT INTO metodos (nombre, descripcion) VALUES
('Espectrofotometría', 'Método espectrofotométrico'),
('Inmunoanálisis', 'Método inmunológico'),
('Electroforesis', 'Método de separación electroforética'),
('ELISA', 'Ensayo por inmunoabsorción ligado a enzimas'),
('Quimioluminiscencia', 'Método de quimioluminiscencia');

-- Tarifario inicial
INSERT INTO tarifarios (nombre, descripcion) VALUES
('Tarifario General', 'Tarifario general para particulares'),
('Tarifario Corporativo', 'Tarifario para empresas');

-- Análisis de ejemplo con sinonimia
INSERT INTO analisis (nombre, descripcion, sinonimia) VALUES
('Hemograma Completo', 'Conteo completo de células sanguíneas', ARRAY['CBC', 'Hemograma', 'Blood Count']),
('Glucosa en Sangre', 'Medición de glucosa sérica', ARRAY['Glucosa', 'Glicemia', 'Blood Glucose', 'FBS']),
('HCG Beta Cuantitativo', 'Hormona Gonadotropina Coriónica Beta', ARRAY['HCG', 'HCGG', 'Beta HCG', 'Prueba de Embarazo']),
('Perfil Lipídico', 'Análisis de lípidos en sangre', ARRAY['Lípidos', 'Colesterol', 'Lipid Panel']),
('TSH', 'Hormona Estimulante de Tiroides', ARRAY['TSH', 'Tirotropina', 'Thyroid']);

-- Componentes para Hemograma Completo
INSERT INTO componentes (analisis_id, nombre, valor_referencial, unidad_medida, area_id, metodo_id, orden) VALUES
(1, 'Hemoglobina', '12.0 - 16.0', 'g/dL', 1, 1, 1),
(1, 'Hematocrito', '36.0 - 46.0', '%', 1, 1, 2),
(1, 'Leucocitos', '4.5 - 11.0', 'x10³/µL', 1, 1, 3),
(1, 'Plaquetas', '150 - 400', 'x10³/µL', 1, 1, 4);

-- Componentes para Glucosa
INSERT INTO componentes (analisis_id, nombre, valor_referencial, unidad_medida, area_id, metodo_id, orden) VALUES
(2, 'Glucosa', '70 - 100', 'mg/dL', 2, 1, 1);

-- Componentes para HCG
INSERT INTO componentes (analisis_id, nombre, valor_referencial, unidad_medida, area_id, metodo_id, orden) VALUES
(3, 'HCG Beta Cuantitativo', '< 5', 'mUI/mL', 5, 4, 1);

-- Componentes para Perfil Lipídico
INSERT INTO componentes (analisis_id, nombre, valor_referencial, unidad_medida, area_id, metodo_id, orden) VALUES
(4, 'Colesterol Total', '< 200', 'mg/dL', 2, 1, 1),
(4, 'Triglicéridos', '< 150', 'mg/dL', 2, 1, 2),
(4, 'HDL Colesterol', '> 40', 'mg/dL', 2, 1, 3),
(4, 'LDL Colesterol', '< 130', 'mg/dL', 2, 1, 4);

-- Componentes para TSH
INSERT INTO componentes (analisis_id, nombre, valor_referencial, unidad_medida, area_id, metodo_id, orden) VALUES
(5, 'TSH', '0.4 - 4.0', 'µUI/mL', 5, 5, 1);

-- Precios para Tarifario General
INSERT INTO tarifario_precios (tarifario_id, analisis_id, precio) VALUES
(1, 1, 25.00), -- Hemograma
(1, 2, 10.00), -- Glucosa
(1, 3, 35.00), -- HCG
(1, 4, 40.00), -- Perfil Lipídico
(1, 5, 30.00); -- TSH

-- Precios para Tarifario Corporativo (más bajo)
INSERT INTO tarifario_precios (tarifario_id, analisis_id, precio) VALUES
(2, 1, 20.00), -- Hemograma
(2, 2, 8.00),  -- Glucosa
(2, 3, 30.00), -- HCG
(2, 4, 35.00), -- Perfil Lipídico
(2, 5, 25.00); -- TSH

-- Convenio de ejemplo
INSERT INTO convenios (nombre_empresa, ruc, direccion, telefono, tarifario_id) VALUES
('Empresa ABC S.A.C.', '20123456789', 'Av. Empresarial 456', '01-987654', 2);

-- Configuración del sistema
INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
('nombre_empresa', 'ViteLab - Laboratorio Clínico', 'Nombre de la empresa'),
('ruc_empresa', '20987654321', 'RUC de la empresa'),
('direccion_empresa', 'Av. Salud 789, Lima - Perú', 'Dirección de la empresa'),
('telefono_empresa', '01-555-0123', 'Teléfono de la empresa'),
('email_empresa', 'contacto@vitelab.com', 'Email de la empresa'),
('logo_url', '/uploads/logo.png', 'URL del logo de la empresa');

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar relaciones (Foreign Keys)
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
