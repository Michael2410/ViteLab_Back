-- ============================================================
-- MIGRACIÓN 029: Autenticación de Doble Factor (2FA - TOTP)
-- ============================================================
BEGIN;

-- 1. Agregar columnas para 2FA TOTP a la tabla usuarios
ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
    ADD COLUMN IF NOT EXISTS two_factor_temp_secret TEXT,
    ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT;

-- 2. Comentarios descriptivos de las columnas
COMMENT ON COLUMN public.usuarios.two_factor_enabled IS 'Indica si el usuario tiene el doble factor (TOTP) activo';
COMMENT ON COLUMN public.usuarios.two_factor_secret IS 'Secreto Base32 del algoritmo TOTP (Google / MS Authenticator)';
COMMENT ON COLUMN public.usuarios.two_factor_temp_secret IS 'Secreto temporal durante la vinculación inicial mediante código QR';
COMMENT ON COLUMN public.usuarios.two_factor_backup_codes IS 'Array JSON con los códigos de respaldo de emergencia de un solo uso';

-- 3. Índice para optimización de consultas de usuarios con 2FA
CREATE INDEX IF NOT EXISTS idx_usuarios_2fa_enabled ON public.usuarios(two_factor_enabled);

COMMIT;
