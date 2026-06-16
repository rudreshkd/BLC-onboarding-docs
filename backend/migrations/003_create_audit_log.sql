-- 003_create_audit_log.sql — append-only audit trail (TASK 3.1)
--
-- Every meaningful event is recorded with who (actor) and when. invite_id is
-- ON DELETE SET NULL so the audit trail survives invite purge (the row remains,
-- de-linked) for compliance evidence.
--
--   actor: 'candidate' | 'hr:{user_id}' | 'system'
--   event: invite_created | link_sent | link_verified | form_progress_updated
--        | pack_submitted | pack_downloaded | pack_received | pack_purged
--        | scheduled_purge

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  invite_id   UUID REFERENCES invites(id) ON DELETE SET NULL,
  event       TEXT NOT NULL,
  actor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_invite_id ON audit_log(invite_id);
