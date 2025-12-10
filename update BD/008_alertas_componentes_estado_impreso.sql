-- ============================================
-- 008: ALERTAS EN COMPONENTES Y ESTADO IMPRESO
-- Fecha: 2024-12
-- Descripción: 
--   1. Agregar campos valor_alerta_min y valor_alerta_max a componentes
--   2. Agregar nuevo estado 'IMPRESO' a órdenes
-- ============================================

-- ============================================
-- 1. AGREGAR CAMPOS DE ALERTA A COMPONENTES
-- ============================================

-- Agregar campo valor_alerta_min (valor mínimo de alerta)
ALTER TABLE componentes 
ADD COLUMN IF NOT EXISTS valor_alerta_min DECIMAL(10,4) DEFAULT NULL;

-- Agregar campo valor_alerta_max (valor máximo de alerta)
ALTER TABLE componentes 
ADD COLUMN IF NOT EXISTS valor_alerta_max DECIMAL(10,4) DEFAULT NULL;

-- Comentarios descriptivos
COMMENT ON COLUMN componentes.valor_alerta_min IS 'Valor mínimo de alerta. Si el resultado es menor a este valor, se mostrará una alerta al guardar/aprobar.';
COMMENT ON COLUMN componentes.valor_alerta_max IS 'Valor máximo de alerta. Si el resultado es mayor a este valor, se mostrará una alerta al guardar/aprobar.';

-- ============================================
-- 2. ACTUALIZAR CONSTRAINT DE ESTADO EN ÓRDENES
-- ============================================

-- Primero eliminamos el constraint existente (si existe)
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_check;

-- Agregar el nuevo constraint con el estado IMPRESO
ALTER TABLE ordenes 
ADD CONSTRAINT ordenes_estado_check 
CHECK (estado IN ('REGISTRADA', 'CON_RESULTADOS', 'APROBADA', 'IMPRESO'));

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que los campos se agregaron correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'componentes' 
AND column_name IN ('valor_alerta_min', 'valor_alerta_max');

-- Verificar constraint de estado
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'ordenes'::regclass 
AND contype = 'c';

-- ============================================
-- EJEMPLO DE USO
-- ============================================

-- Actualizar un componente con valores de alerta
-- UPDATE componentes SET valor_alerta_min = 70.0, valor_alerta_max = 110.0 WHERE nombre = 'Glucosa';

-- Cambiar una orden a estado IMPRESO
-- UPDATE ordenes SET estado = 'IMPRESO' WHERE id = 1;
