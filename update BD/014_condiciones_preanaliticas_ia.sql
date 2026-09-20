-- ============================================
-- 014: CONDICIONES PRE-ANALÍTICAS IA PARA ÓRDENES
-- ============================================
-- Descripción: Agrega campo para almacenar las indicaciones 
-- pre-analíticas generadas por IA (Gemini) considerando 
-- exámenes, edad y sexo del paciente.
-- ============================================

ALTER TABLE ordenes 
ADD COLUMN IF NOT EXISTS condiciones_preanaliticas TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN ordenes.condiciones_preanaliticas IS 'Indicaciones pre-analíticas generadas por IA (Gemini) para la preparación del paciente';

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'ordenes' AND column_name = 'condiciones_preanaliticas';
