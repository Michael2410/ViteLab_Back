-- ============================================
-- 009: CONFIGURACIÓN DEL SISTEMA
-- Fecha: 2024-12
-- Descripción: 
--   Crear tabla para almacenar la configuración
--   general del sistema (datos de empresa, logo, etc)
-- ============================================

-- ============================================
-- 1. CREAR TABLA DE CONFIGURACIÓN
-- ============================================

CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id SERIAL PRIMARY KEY,
    -- Datos de la empresa
    empresa_nombre VARCHAR(200) NOT NULL DEFAULT 'LABORATORIO',
    empresa_razon_social VARCHAR(200),
    empresa_ruc VARCHAR(20),
    empresa_direccion VARCHAR(300),
    empresa_telefono VARCHAR(50),
    empresa_email VARCHAR(100),
    empresa_web VARCHAR(150),
    
    -- Logos e imágenes
    logo_principal VARCHAR(255),
    logo_secundario VARCHAR(255),
    
    -- Configuración de impresión
    encabezado_reporte TEXT,
    pie_reporte TEXT,
    
    -- Configuración general
    moneda VARCHAR(10) DEFAULT 'PEN',
    igv_porcentaje DECIMAL(5,2) DEFAULT 18.00,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios descriptivos
COMMENT ON TABLE configuracion_sistema IS 'Almacena la configuración general del sistema y datos de la empresa';
COMMENT ON COLUMN configuracion_sistema.empresa_nombre IS 'Nombre comercial de la empresa';
COMMENT ON COLUMN configuracion_sistema.empresa_razon_social IS 'Razón social para documentos legales';
COMMENT ON COLUMN configuracion_sistema.empresa_ruc IS 'RUC de la empresa';
COMMENT ON COLUMN configuracion_sistema.logo_principal IS 'Ruta del logo principal';
COMMENT ON COLUMN configuracion_sistema.logo_secundario IS 'Ruta del logo secundario (opcional)';

-- ============================================
-- 2. INSERTAR REGISTRO INICIAL
-- ============================================

INSERT INTO configuracion_sistema (
    empresa_nombre,
    empresa_razon_social,
    empresa_ruc,
    empresa_direccion,
    empresa_telefono,
    empresa_email
) VALUES (
    'VITELAB',
    'LABORATORIO VITELAB S.A.C.',
    '20123456789',
    'Av. Principal 123, Lima',
    '01-1234567',
    'contacto@vitelab.com'
) ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que la tabla se creó correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'configuracion_sistema'
ORDER BY ordinal_position;

-- Verificar el registro inicial
SELECT * FROM configuracion_sistema;
