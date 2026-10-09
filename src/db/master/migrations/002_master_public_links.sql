-- Migración 002: Enlaces Públicos Opacos y Enlaces Externos en Master DB
-- Conforme a Sección 21 de GUIA-AGENTE.md (Fase 3: Aislamiento)

CREATE TABLE IF NOT EXISTS public_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     TEXT NOT NULL UNIQUE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purpose        VARCHAR(30) NOT NULL CHECK (purpose IN ('RESULT_VIEW','REPORT_VERIFY')),
  resource_type  VARCHAR(50)  NOT NULL,
  resource_id    VARCHAR(100) NOT NULL,
  expires_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_links_hash ON public_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_public_links_tenant ON public_links(tenant_id);

CREATE TABLE IF NOT EXISTS external_bindings (
  provider             VARCHAR(50)  NOT NULL,
  external_account_id  VARCHAR(200) NOT NULL,
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, external_account_id)
);
