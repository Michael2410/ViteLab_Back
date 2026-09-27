-- =======================================================
-- SCRIPT 019: FLUJO DE CESE / DAR DE BAJA Y GESTIÓN DE CUENTA
-- Descripción:
--   1. Agregar columnas de cese a la tabla personal:
--      - fecha_cese DATE
--      - motivo_cese VARCHAR(100)
--      - observaciones_cese TEXT
--   2. Crear índices para optimizar consultas de personal cesado
-- =======================================================

-- 1. AGREGAR COLUMNAS DE CESE A PERSONAL
ALTER TABLE personal ADD COLUMN IF NOT EXISTS fecha_cese DATE;
ALTER TABLE personal ADD COLUMN IF NOT EXISTS motivo_cese VARCHAR(100);
ALTER TABLE personal ADD COLUMN IF NOT EXISTS observaciones_cese TEXT;

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_personal_fecha_cese ON personal(fecha_cese);
CREATE INDEX IF NOT EXISTS idx_personal_motivo_cese ON personal(motivo_cese);

COMMENT ON COLUMN personal.fecha_cese IS 'Fecha efectiva del cese o último día laboral';
COMMENT ON COLUMN personal.motivo_cese IS 'Motivo de baja laboral (Renuncia, Término de Contrato, etc.)';
COMMENT ON COLUMN personal.observaciones_cese IS 'Observaciones, número de carta de renuncia o notas de RRHH';
