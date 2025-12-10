-- ============================================
-- 011: INTERPRETACIÓN IA PARA RESULTADOS
-- ============================================
-- Descripción: Agrega campo para almacenar la interpretación 
-- generada por IA (Gemini) de los resultados de laboratorio
-- ============================================

-- 1. Agregar campo interpretacion_ia a la tabla ordenes
ALTER TABLE ordenes 
ADD COLUMN IF NOT EXISTS interpretacion_ia TEXT;

-- Comentario descriptivo
COMMENT ON COLUMN ordenes.interpretacion_ia IS 'Interpretación de resultados generada por IA (Gemini) para el paciente';

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'ordenes' AND column_name = 'interpretacion_ia';
