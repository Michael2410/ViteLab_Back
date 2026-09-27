-- ============================================================
-- MIGRACIÓN 021: Historial / Log Laboral y Gestión de Contratos
-- Módulo de Personal (RRHH) - ViteLab
-- ============================================================

-- 1. TABLA personal_historial_laboral (Auditoría de Altas, Ceses y Reingresos)
CREATE TABLE IF NOT EXISTS personal_historial_laboral (
    id SERIAL PRIMARY KEY,
    personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    tipo_evento VARCHAR(50) NOT NULL, -- 'ALTA_INICIAL', 'CESE', 'REINGRESO', 'NUEVO_CONTRATO', 'CAMBIO_CARGO', 'CAMBIO_SUELDO'
    fecha_evento DATE NOT NULL,
    cargo VARCHAR(100),
    area VARCHAR(100),
    tipo_contrato VARCHAR(100),
    sueldo_base NUMERIC(10,2),
    motivo_cese_id INTEGER REFERENCES personal_motivos_cese(id) ON DELETE SET NULL,
    motivo_cese_texto VARCHAR(150),
    observaciones TEXT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_historial_personal_id ON personal_historial_laboral(personal_id);
CREATE INDEX IF NOT EXISTS idx_historial_tipo_evento ON personal_historial_laboral(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_historial_fecha_evento ON personal_historial_laboral(fecha_evento);

COMMENT ON TABLE personal_historial_laboral IS 'Log histórico de eventos laborales: altas, ceses y reincorporaciones del personal';

-- 2. TABLA personal_contratos (Gestión Contractual y Alertas de Vencimiento)
CREATE TABLE IF NOT EXISTS personal_contratos (
    id SERIAL PRIMARY KEY,
    personal_id INTEGER NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
    tipo_contrato_id INTEGER REFERENCES personal_tipos_contrato(id) ON DELETE SET NULL,
    tipo_contrato_nombre VARCHAR(100),
    numero_contrato VARCHAR(50),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    es_indefinido BOOLEAN DEFAULT false,
    cargo VARCHAR(100),
    sueldo_pactado NUMERIC(10,2),
    archivo_url TEXT,
    estado VARCHAR(30) DEFAULT 'VIGENTE', -- 'VIGENTE', 'POR_VENCER', 'VENCIDO', 'RENOVADO', 'CANCELADO'
    observaciones TEXT,
    usuario_registro_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contratos_personal_id ON personal_contratos(personal_id);
CREATE INDEX IF NOT EXISTS idx_contratos_estado ON personal_contratos(estado);
CREATE INDEX IF NOT EXISTS idx_contratos_fecha_fin ON personal_contratos(fecha_fin);

COMMENT ON TABLE personal_contratos IS 'Registro de contratos de trabajo, adendas y vigencias del personal';

-- 3. Poblar historial inicial con el personal ya existente en la base de datos
INSERT INTO personal_historial_laboral (
    personal_id,
    tipo_evento,
    fecha_evento,
    cargo,
    area,
    tipo_contrato,
    sueldo_base,
    observaciones
)
SELECT 
    p.id,
    CASE 
        WHEN p.activo = false AND p.fecha_cese IS NOT NULL THEN 'CESE'
        ELSE 'ALTA_INICIAL'
    END,
    COALESCE(
        CASE WHEN p.activo = false AND p.fecha_cese IS NOT NULL THEN p.fecha_cese ELSE p.fecha_ingreso END,
        p.created_at::date,
        CURRENT_DATE
    ),
    p.cargo,
    p.area,
    p.tipo_contrato,
    p.sueldo_base,
    'Registro histórico inicial migrado automáticamente'
FROM personal p
WHERE NOT EXISTS (
    SELECT 1 FROM personal_historial_laboral h WHERE h.personal_id = p.id
);
