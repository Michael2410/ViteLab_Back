-- ============================================================
-- MIGRACIÓN 022: Control de Vacaciones, Asistencia y Documentos
-- Módulo de Personal (RRHH) - ViteLab
-- ============================================================

-- 1. TABLA personal_vacaciones (Gestión y Solicitudes de Vacaciones)
CREATE TABLE IF NOT EXISTS personal_vacaciones (
    id SERIAL PRIMARY KEY,
    personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_solicitados INTEGER NOT NULL CHECK (dias_solicitados > 0),
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'APROBADA', 'RECHAZADA', 'TOMADA', 'CANCELADA'
    motivo TEXT,
    observaciones_aprobador TEXT,
    aprobado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_aprobacion DATE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_vacaciones_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_personal_id ON personal_vacaciones(personal_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_estado ON personal_vacaciones(estado);
CREATE INDEX IF NOT EXISTS idx_vacaciones_fechas ON personal_vacaciones(fecha_inicio, fecha_fin);

COMMENT ON TABLE personal_vacaciones IS 'Registro de periodos y solicitudes vacacionales del personal';

-- 2. TABLA personal_asistencia (Control Diario de Marcaciones y Faltas)
CREATE TABLE IF NOT EXISTS personal_asistencia (
    id SERIAL PRIMARY KEY,
    personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_entrada TIME,
    hora_salida TIME,
    minutos_tardanza INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(40) NOT NULL DEFAULT 'PRESENTE', -- 'PRESENTE', 'TARDANZA', 'FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA', 'PERMISO_MEDICO', 'LICENCIA'
    justificacion TEXT,
    sede_id INTEGER REFERENCES sedes(id) ON DELETE SET NULL,
    usuario_registro_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_personal_fecha UNIQUE (personal_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_personal_id ON personal_asistencia(personal_id);
CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON personal_asistencia(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencia_estado ON personal_asistencia(estado);

COMMENT ON TABLE personal_asistencia IS 'Control diario de asistencia, tardanzas y justificaciones de inasistencia';

-- 3. TABLA personal_documentos (Emisión y Registro de Constancias / Certificados)
CREATE TABLE IF NOT EXISTS personal_documentos (
    id SERIAL PRIMARY KEY,
    personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(50) NOT NULL, -- 'CONSTANCIA_TRABAJO', 'CERTIFICADO_LABORAL', 'CARTA_PRESENTACION', 'BOLETA_PAGO'
    codigo_emision VARCHAR(50) NOT NULL UNIQUE,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    destinatario VARCHAR(200) DEFAULT 'A quien corresponda',
    cargo_consignado VARCHAR(100),
    remuneracion_consignada NUMERIC(10,2),
    archivo_url TEXT,
    observaciones TEXT,
    emitido_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documentos_personal_id ON personal_documentos(personal_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON personal_documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_codigo ON personal_documentos(codigo_emision);

COMMENT ON TABLE personal_documentos IS 'Historial y registro oficial de documentos y certificados laborales emitidos';
