-- Script para agregar campo medico a la tabla ordenes
-- Ejecutar en la base de datos

-- 1. Agregar columna medico a la tabla ordenes
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS medico VARCHAR(255);

-- 2. Comentario descriptivo
COMMENT ON COLUMN ordenes.medico IS 'Nombre del médico que solicita los análisis (texto libre)';

-- 3. Crear índice para optimizar búsquedas de médicos distintos
CREATE INDEX IF NOT EXISTS idx_ordenes_medico ON ordenes(medico) WHERE medico IS NOT NULL;

-- Verificar que se agregó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ordenes' AND column_name = 'medico';
