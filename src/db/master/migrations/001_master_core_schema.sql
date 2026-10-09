-- ============================================================
-- MASTER DB MIGRATION 001: Esquema Núcleo de vitelab_master
-- Conforme a Secciones 4, 5, 5.1, 6, 12.5, 16.3, 27 y 29.2 de GUIA-AGENTE.md
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabla: tenants (Laboratorios clínicos)
CREATE TABLE IF NOT EXISTS tenants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               VARCHAR(40)  NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z0-9_]{3,40}$'),
  name               VARCHAR(150) NOT NULL,
  database_name      VARCHAR(63)  NOT NULL UNIQUE
                     CHECK (database_name ~ '^[a-z][a-z0-9_]{2,62}$'),
  db_cluster         VARCHAR(50)  NOT NULL DEFAULT 'default',
  status             VARCHAR(30)  NOT NULL
                     CHECK (status IN ('PROVISIONING','PROVISIONING_FAILED',
                                       'ACTIVE','SUSPENDED','ARCHIVED')),
  provisioning_step  VARCHAR(50),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. Tabla: identities (Identidad global y credenciales)
CREATE TABLE IF NOT EXISTS identities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(255) NOT NULL UNIQUE
                        CHECK (email = lower(btrim(email))),
  email_verified_at     TIMESTAMPTZ,
  password_hash         TEXT,           -- NULL mientras status = INVITED
  password_changed_at   TIMESTAMPTZ,
  must_change_password  BOOLEAN      NOT NULL DEFAULT FALSE,
  status                VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('INVITED','ACTIVE','LOCKED','DISABLED')),
  mfa_enabled           BOOLEAN      NOT NULL DEFAULT FALSE,
  mfa_secret_enc        TEXT,           -- Secreto TOTP cifrado AES-256-GCM
  mfa_enrolled_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (status <> 'ACTIVE' OR password_hash IS NOT NULL)
);

-- 3. Tabla: mfa_backup_codes (Códigos de respaldo hasheados)
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id  UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  code_hash    TEXT NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_identity ON mfa_backup_codes(identity_id);

-- 4. Tabla: memberships (Relación Identidad <-> Tenant)
CREATE TABLE IF NOT EXISTS memberships (
  identity_id  UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  tenant_id    UUID NOT NULL REFERENCES tenants(id)    ON DELETE RESTRICT,
  status       VARCHAR(20) NOT NULL
               CHECK (status IN ('PENDING','INVITED','ACTIVE','SUSPENDED','REVOKED')),
  invited_by   UUID REFERENCES identities(id),
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);

-- 5. Tabla: sessions (Sesiones y rotación de refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id                   UUID NOT NULL REFERENCES identities(id),
  tenant_id                     UUID REFERENCES tenants(id),
  refresh_token_hash            TEXT NOT NULL UNIQUE,
  previous_refresh_token_hash   TEXT,
  mfa_verified_at               TIMESTAMPTZ,
  ip                            INET,
  user_agent                    TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                    TIMESTAMPTZ NOT NULL,
  revoked_at                    TIMESTAMPTZ,
  revoked_reason                VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_sessions_identity_active ON sessions(identity_id) WHERE revoked_at IS NULL;

-- 6. Tabla: identity_tokens (Invitaciones, password reset, cambio de email)
CREATE TABLE IF NOT EXISTS identity_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id  UUID NOT NULL REFERENCES identities(id),
  tenant_id    UUID REFERENCES tenants(id),
  purpose      VARCHAR(30) NOT NULL
               CHECK (purpose IN ('INVITE_NEW','INVITE_TENANT','PASSWORD_RESET','EMAIL_CHANGE')),
  token_hash   TEXT NOT NULL UNIQUE,
  payload      JSONB,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Tabla: platform_admins (Superadmins de la plataforma ViteLab)
CREATE TABLE IF NOT EXISTS platform_admins (
  identity_id  UUID PRIMARY KEY REFERENCES identities(id),
  role         VARCHAR(30) NOT NULL CHECK (role IN ('SUPERADMIN','SUPPORT')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tabla: auth_events (Auditoría de eventos de autenticación y seguridad)
CREATE TABLE IF NOT EXISTS auth_events (
  id           BIGSERIAL PRIMARY KEY,
  identity_id  UUID,
  tenant_id    UUID,
  event        VARCHAR(50) NOT NULL,
  ip           INET,
  user_agent   TEXT,
  detail       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_identity ON auth_events(identity_id, created_at);
