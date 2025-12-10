-- =====================================================
-- CAMBIO: Valores Referenciales como Array de Texto
-- FECHA: 2025-12-01
-- =====================================================

BEGIN;

-- 1. Agregar nueva columna valores_referenciales como array de texto
ALTER TABLE componentes 
ADD COLUMN valores_referenciales TEXT[] DEFAULT '{}';

-- 2. Migrar datos existentes de valor_referencial a valores_referenciales
UPDATE componentes
SET valores_referenciales = ARRAY[valor_referencial]
WHERE valor_referencial IS NOT NULL AND valor_referencial != '';

-- 3. Eliminar columna antigua (opcional - descomenta después de verificar)
ALTER TABLE componentes DROP COLUMN valor_referencial;

COMMIT;

-- Verificación
SELECT id, nombre, valores_referenciales FROM componentes LIMIT 10;

-- =====================================================
-- EJEMPLOS DE USO:
-- valores_referenciales = ARRAY['10-20', '21-40', '41-50']
-- valores_referenciales = ARRAY['Negativo', 'Positivo']
-- valores_referenciales = ARRAY['< 100', '100-200', '> 200']
-- =====================================================
