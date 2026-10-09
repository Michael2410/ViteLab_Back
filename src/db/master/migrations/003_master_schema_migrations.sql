-- ====================================================================
-- MASTER MIGRATION: 003_master_schema_migrations.sql
-- Control de versiones de esquema en la base de datos Master
-- ====================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version      VARCHAR(100) PRIMARY KEY,
  checksum     CHAR(64)     NOT NULL,
  applied_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  duration_ms  INTEGER
);
