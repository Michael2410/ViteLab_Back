-- ============================================
-- 010: USUARIOS-SEDES Y RECEPCIÓN DE MUESTRAS
-- Fecha: 2024-12
-- Descripción: 
--   1. Crear tabla usuarios_sedes (relación N:N)
--   2. Agregar estado MUESTRA_RECIBIDA a ordenes
--   3. Agregar campos de recepción de muestra
--   4. Agregar tipo_paciente a órdenes
-- ============================================

-- ============================================
-- 1. CREAR TABLA USUARIOS_SEDES
-- ============================================

CREATE TABLE IF NOT EXISTS usuarios_sedes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    sede_id INTEGER NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, sede_id)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_usuarios_sedes_usuario ON usuarios_sedes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sedes_sede ON usuarios_sedes(sede_id);

-- Comentarios
COMMENT ON TABLE usuarios_sedes IS 'Relación muchos a muchos entre usuarios y sedes';
COMMENT ON COLUMN usuarios_sedes.usuario_id IS 'ID del usuario';
COMMENT ON COLUMN usuarios_sedes.sede_id IS 'ID de la sede asignada al usuario';

-- ============================================
-- 2. MODIFICAR CONSTRAINT DE ESTADO_ORDEN
-- ============================================

-- Eliminar constraint existente y crear uno nuevo con MUESTRA_RECIBIDA
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_check;

ALTER TABLE ordenes ADD CONSTRAINT ordenes_estado_check 
CHECK (estado IN ('REGISTRADA', 'MUESTRA_RECIBIDA', 'CON_RESULTADOS', 'APROBADA', 'IMPRESO'));

-- ============================================
-- 3. AGREGAR CAMPOS DE RECEPCIÓN A ORDENES
-- ============================================

-- Campo para usuario que recepcionó la muestra
ALTER TABLE ordenes 
ADD COLUMN IF NOT EXISTS usuario_recepcion_id INTEGER REFERENCES usuarios(id);

-- Campo para fecha/hora de recepción
ALTER TABLE ordenes 
ADD COLUMN IF NOT EXISTS fecha_recepcion TIMESTAMP;

-- Campo para tipo de paciente (particular o convenio)
ALTER TABLE ordenes 
ADD COLUMN IF NOT EXISTS tipo_paciente VARCHAR(20) DEFAULT 'PARTICULAR';

-- Comentarios
COMMENT ON COLUMN ordenes.usuario_recepcion_id IS 'Usuario que recepcionó la muestra';
COMMENT ON COLUMN ordenes.fecha_recepcion IS 'Fecha y hora de recepción de la muestra';
COMMENT ON COLUMN ordenes.tipo_paciente IS 'Tipo de paciente: PARTICULAR o CONVENIO';

-- ============================================
-- 4. ACTUALIZAR ÓRDENES EXISTENTES
-- ============================================

-- Establecer tipo_paciente basado en convenio_id
UPDATE ordenes 
SET tipo_paciente = CASE 
    WHEN convenio_id IS NOT NULL THEN 'CONVENIO'
    ELSE 'PARTICULAR'
END
WHERE tipo_paciente IS NULL OR tipo_paciente = 'PARTICULAR';

-- ============================================
-- 5. ASIGNAR TODAS LAS SEDES AL USUARIO ADMIN
-- ============================================

-- Asignar todas las sedes existentes al usuario admin (id=1)
INSERT INTO usuarios_sedes (usuario_id, sede_id)
SELECT 1, id FROM sedes WHERE activo = true
ON CONFLICT (usuario_id, sede_id) DO NOTHING;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar tabla usuarios_sedes
SELECT 'Tabla usuarios_sedes creada' as resultado;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usuarios_sedes'
ORDER BY ordinal_position;

-- Verificar nuevos campos en ordenes
SELECT 'Campos agregados a ordenes' as resultado;
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ordenes' 
AND column_name IN ('usuario_recepcion_id', 'fecha_recepcion', 'tipo_paciente')
ORDER BY ordinal_position;

-- Ver sedes asignadas al admin
SELECT 'Sedes asignadas al admin' as resultado;
SELECT u.username, s.nombre as sede
FROM usuarios_sedes us
JOIN usuarios u ON us.usuario_id = u.id
JOIN sedes s ON us.sede_id = s.id
WHERE u.id = 1;
