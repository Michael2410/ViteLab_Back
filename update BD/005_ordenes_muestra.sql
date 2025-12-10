-- ============================================
-- 005: MODIFICACIONES PARA ÓRDENES
-- Agregar campos muestra_recepcionada y muestras_ids
-- ============================================

-- 1. Agregar campo muestra_recepcionada a la tabla ordenes
ALTER TABLE ordenes 
ADD COLUMN IF NOT EXISTS muestra_recepcionada BOOLEAN DEFAULT FALSE;

-- 2. Eliminar campo muestra_id si existe y agregar muestras_ids como array
-- Primero verificamos si existe muestra_id y lo eliminamos
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orden_analisis' AND column_name = 'muestra_id'
    ) THEN
        ALTER TABLE orden_analisis DROP COLUMN muestra_id;
    END IF;
END $$;

-- Agregar campo muestras_ids como array de enteros
ALTER TABLE orden_analisis 
ADD COLUMN IF NOT EXISTS muestras_ids INTEGER[] DEFAULT '{}';

-- 3. Agregar índice para búsqueda por sinonimia en análisis (si no existe)
-- Esto mejora la performance al buscar por sinonimia
CREATE INDEX IF NOT EXISTS idx_analisis_sinonimia ON analisis USING GIN (sinonimia);

-- 4. Verificar que existe un tarifario por defecto para particulares
-- Si no existe "Tarifario General", lo crea
INSERT INTO tarifarios (nombre, descripcion, activo)
SELECT 'Tarifario General', 'Tarifario por defecto para clientes particulares', true
WHERE NOT EXISTS (
    SELECT 1 FROM tarifarios WHERE nombre = 'Tarifario General'
);

-- 5. Comentarios de verificación
COMMENT ON COLUMN ordenes.muestra_recepcionada IS 'Indica si la muestra fue recepcionada (true) o está pendiente (false)';
COMMENT ON COLUMN orden_analisis.muestras_ids IS 'Array de IDs de los tipos de muestra seleccionados para este análisis';
