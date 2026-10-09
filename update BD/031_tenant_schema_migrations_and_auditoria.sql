-- ====================================================================
-- TENANT MIGRATION: 031_tenant_schema_migrations_and_auditoria.sql
-- Control de versiones de esquema y auditoría en cada Tenant DB
-- ====================================================================

-- 1. Tabla de control de migraciones del tenant
CREATE TABLE IF NOT EXISTS schema_migrations (
  version      VARCHAR(100) PRIMARY KEY,
  checksum     CHAR(64)     NOT NULL,
  applied_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  duration_ms  INTEGER
);

-- 2. Tabla de auditoría append-only
CREATE TABLE IF NOT EXISTS auditoria (
  id               BIGSERIAL PRIMARY KEY,
  identity_id      UUID,
  usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  actor_tipo       VARCHAR(20) NOT NULL CHECK (actor_tipo IN ('user','system','support')),
  accion           VARCHAR(30) NOT NULL,
  recurso          VARCHAR(80) NOT NULL,
  recurso_id       VARCHAR(100),
  valores_antes    JSONB,
  valores_despues  JSONB,
  resultado        VARCHAR(20) NOT NULL,
  ip               INET,
  user_agent       TEXT,
  request_id       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_identity_id ON auditoria (identity_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_recurso ON auditoria (recurso, recurso_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria (created_at);

-- 3. Asegurar columnas de configuración de régimen laboral RRHH
ALTER TABLE configuracion_sistema ADD COLUMN IF NOT EXISTS regimen_laboral VARCHAR(20) DEFAULT 'GENERAL';
