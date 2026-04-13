-- Migration 005: Immutable audit log

CREATE TABLE nse.audit_log (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     UUID,                           -- nullable for system/worker actions
  action      TEXT        NOT NULL,           -- e.g. 'signals.view', 'watchlist.add'
  resource    TEXT,                           -- e.g. 'signals', 'analysis:SCOM'
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB,                          -- sanitised — no PII, no secrets
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nse_audit_user_date   ON nse.audit_log (user_id, created_at DESC);
CREATE INDEX idx_nse_audit_action_date ON nse.audit_log (action,  created_at DESC);

-- RLS: authenticated users can read only their own audit rows
ALTER TABLE nse.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nse_audit_read_own"
  ON nse.audit_log FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- Append-only: revoke UPDATE and DELETE for all non-superuser roles
REVOKE UPDATE, DELETE ON nse.audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON nse.audit_log FROM anon;
