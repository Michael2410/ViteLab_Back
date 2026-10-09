-- ============================================================================
-- MIGRACIÓN 037: Agregar firmante_firma_url a personal_documentos
-- ============================================================================

ALTER TABLE personal_documentos 
ADD COLUMN IF NOT EXISTS firmante_firma_url TEXT;

COMMENT ON COLUMN personal_documentos.firmante_firma_url IS 'URL de la imagen de la firma/sello digital del firmante';
