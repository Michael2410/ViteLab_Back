-- Script para agregar campos de imagen a convenios y usuarios
-- Ejecutar en la base de datos

-- =============================================
-- 1. AGREGAR CAMPO LOGO A CONVENIOS
-- =============================================
ALTER TABLE convenios ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

COMMENT ON COLUMN convenios.logo_url IS 'URL del logo del convenio/empresa';

-- =============================================
-- 2. AGREGAR CAMPO FIRMA A USUARIOS
-- =============================================
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS firma_url VARCHAR(500);

COMMENT ON COLUMN usuarios.firma_url IS 'URL de la firma digital del usuario';

-- =============================================
-- 3. VERIFICAR QUE SE AGREGARON CORRECTAMENTE
-- =============================================
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'convenios' AND column_name = 'logo_url';

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'usuarios' AND column_name = 'firma_url';
