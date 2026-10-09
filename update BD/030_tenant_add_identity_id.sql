-- ============================================================
-- MIGRACIÓN 030: Vincular usuario de laboratorio con Master Identity
-- Conforme a Sección 9 y Sección 24 de GUIA-AGENTE.md
-- ============================================================

-- Paso 1 (Expand): Agregar columna identity_id nullable para permitir el backfill
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS identity_id UUID;

-- Nota: El paso de 'SET NOT NULL' y 'CREATE UNIQUE INDEX uq_usuarios_identity_id'
-- se ejecuta automáticamente por el script de backfill una vez sincronizados
-- todos los usuarios existentes con vitelab_master.identities.
