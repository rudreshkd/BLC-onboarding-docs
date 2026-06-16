-- 002_create_tokens.sql — magic-link tokens (TASK 3.1)
--
-- Single-use, time-limited login tokens. We store only the SHA-256 HASH of the
-- raw token, never the token itself — a DB leak cannot be replayed as a login.
--
--   verify flow: hash(incoming) ─► WHERE token_hash = $1
--                                    AND used_at IS NULL
--                                    AND expires_at > NOW()
--                ─► found: set used_at = NOW() (consumes it, single use)

CREATE TABLE magic_link_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id   UUID NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  -- store SHA-256 hash of the token, never the raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  -- null = not yet used; non-null = consumed (single use)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_magic_link_tokens_token_hash ON magic_link_tokens(token_hash);
