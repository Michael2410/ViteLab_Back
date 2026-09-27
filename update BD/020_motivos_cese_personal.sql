-- ============================================================
-- MIGRACIÓN 020: Catálogo Dinámico de Motivos de Cese Laboral
-- Módulo de Personal (RRHH) - ViteLab
-- ============================================================

-- 1. Crear tabla personal_motivos_cese
CREATE TABLE IF NOT EXISTS personal_motivos_cese (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insertar motivos de cese estándar
INSERT INTO personal_motivos_cese (nombre, descripcion)
VALUES 
    ('Renuncia Voluntaria', 'Decisión voluntaria comunicada por el colaborador mediante carta de renuncia'),
    ('Término / Vencimiento de Contrato', 'Culminación natural del plazo pactado en el contrato de trabajo sujeto a modalidad'),
    ('Mutuo Disenso', 'Acuerdo formal bilateral entre la empresa y el colaborador para poner fin a la relación laboral'),
    ('Despido (Falta Grave / Causa Justa)', 'Terminación por causal justificada de acuerdo a la legislación laboral'),
    ('No superó Período de Prueba', 'Término dentro de los 3 meses iniciales de evaluación (o plazo pactado)'),
    ('Jubilación', 'Cese por límite de edad legal o trámite de pensión de jubilación'),
    ('Abandono de Trabajo', 'Inasistencia injustificada reiterada según causal legal'),
    ('Otro', 'Otras causales no tipificadas en las categorías anteriores')
ON CONFLICT (nombre) DO UPDATE
SET updated_at = CURRENT_TIMESTAMP;

-- 3. Agregar columna motivo_cese_id en la tabla personal
ALTER TABLE personal 
ADD COLUMN IF NOT EXISTS motivo_cese_id INT REFERENCES personal_motivos_cese(id);

-- 4. Crear índice para optimizar búsquedas y relaciones
CREATE INDEX IF NOT EXISTS idx_personal_motivo_cese_id ON personal(motivo_cese_id);

-- 5. Vincular registros históricos si ya existiese algún colaborador con motivo_cese en texto
UPDATE personal p
SET motivo_cese_id = m.id
FROM personal_motivos_cese m
WHERE LOWER(TRIM(p.motivo_cese)) = LOWER(TRIM(m.nombre))
  AND p.motivo_cese_id IS NULL;
