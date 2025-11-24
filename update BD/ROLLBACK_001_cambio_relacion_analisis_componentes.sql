-- =====================================================
-- ROLLBACK: Revertir cambios de relación Análisis-Componentes
-- FECHA: 2025-11-17
-- DESCRIPCIÓN: 
--   Este script revierte los cambios hechos en 
--   001_cambio_relacion_analisis_componentes.sql
-- =====================================================

BEGIN;

-- 1. Restaurar la columna analisis_id como NOT NULL
ALTER TABLE componentes 
ALTER COLUMN analisis_id SET NOT NULL;

-- 2. Restaurar la foreign key constraint
ALTER TABLE componentes 
ADD CONSTRAINT componentes_analisis_id_fkey 
FOREIGN KEY (analisis_id) REFERENCES analisis(id) ON DELETE CASCADE;

-- 3. Migrar datos de vuelta: componentes_ids -> analisis_id
-- (Solo si no has eliminado la columna analisis_id)
UPDATE componentes c
SET analisis_id = (
    SELECT a.id 
    FROM analisis a 
    WHERE c.id = ANY(a.componentes_ids)
    LIMIT 1
)
WHERE analisis_id IS NULL;

-- 4. Eliminar el índice GIN
DROP INDEX IF EXISTS idx_analisis_componentes_ids;

-- 5. Eliminar la columna componentes_ids de analisis
ALTER TABLE analisis 
DROP COLUMN IF EXISTS componentes_ids;

COMMIT;

-- =====================================================
-- NOTA: 
-- Si eliminaste completamente la columna analisis_id de 
-- componentes, este rollback NO funcionará y necesitarás
-- restaurar desde un backup de la base de datos.
-- =====================================================
