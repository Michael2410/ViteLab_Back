-- =====================================================
-- CAMBIO: Relación Análisis-Componentes
-- FECHA: 2025-11-17
-- DESCRIPCIÓN: 
--   - Eliminar columna analisis_id de componentes
--   - Agregar columna componentes_ids (array) en analisis
--   - Los componentes serán entidades independientes
--   - Cada análisis tendrá un array de IDs de componentes
-- =====================================================

BEGIN;

-- 1. Agregar nueva columna componentes_ids en la tabla analisis
ALTER TABLE analisis 
ADD COLUMN componentes_ids INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN analisis.componentes_ids IS 'Array de IDs de componentes asociados a este análisis';

-- 2. Migrar datos existentes (si hay)
-- Crear array de componentes_ids para cada análisis basado en la relación actual
UPDATE analisis a
SET componentes_ids = (
    SELECT ARRAY_AGG(c.id ORDER BY c.orden, c.nombre)
    FROM componentes c
    WHERE c.analisis_id = a.id
      AND c.activo = true
)
WHERE EXISTS (
    SELECT 1 FROM componentes c WHERE c.analisis_id = a.id
);

-- 3. Eliminar la foreign key constraint de componentes (si existe)
ALTER TABLE componentes 
DROP CONSTRAINT IF EXISTS componentes_analisis_id_fkey;

-- 4. Hacer la columna analisis_id nullable (por si hay componentes sin análisis)
ALTER TABLE componentes 
ALTER COLUMN analisis_id DROP NOT NULL;

-- 5. Opcional: Si quieres eliminar completamente la columna analisis_id
-- Descomenta estas líneas después de verificar que todo funciona:
-- ALTER TABLE componentes 
-- DROP COLUMN analisis_id;

-- 6. Crear índice para mejorar búsquedas por componentes_ids
CREATE INDEX IF NOT EXISTS idx_analisis_componentes_ids 
ON analisis USING GIN (componentes_ids);

COMMIT;

-- =====================================================
-- NOTAS:
-- =====================================================
-- 1. La columna analisis_id en componentes se deja nullable
--    pero puedes eliminarla después de verificar que todo funciona
-- 
-- 2. Los componentes ahora son entidades independientes que pueden
--    ser reutilizados por múltiples análisis
--
-- 3. Para obtener los componentes de un análisis usar:
--    SELECT c.* FROM componentes c 
--    WHERE c.id = ANY(a.componentes_ids)
--
-- 4. Para agregar un componente a un análisis:
--    UPDATE analisis 
--    SET componentes_ids = array_append(componentes_ids, <componente_id>)
--    WHERE id = <analisis_id>
--
-- 5. Para eliminar un componente de un análisis:
--    UPDATE analisis 
--    SET componentes_ids = array_remove(componentes_ids, <componente_id>)
--    WHERE id = <analisis_id>
-- =====================================================

-- Verificación: Mostrar algunos análisis con sus componentes
SELECT 
    a.id,
    a.nombre,
    a.componentes_ids,
    (SELECT COUNT(*) FROM unnest(a.componentes_ids)) as total_componentes
FROM analisis a
LIMIT 10;
