-- 001_create_invites.sql — candidate invites (TASK 3.1)
--
-- Two-table-plus-audit metadata store. NO form-answer columns: the candidate's
-- field values live ONLY in the encrypted pack (object storage). form_progress
-- holds per-form STATUS STRINGS ONLY (never PII) so the HR record inspector
-- (Phase 4.3) can show per-form completion without exposing answers.
--
--   status:        invited ──► in_progress ──► submitted ──► received
--   form_progress: { "bank": "completed", "application": "in_progress", ... }

CREATE TABLE invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  role          TEXT NOT NULL,
  offer_terms   JSONB NOT NULL,
  -- offer_terms shape: { startDate, salary, hours, manager }
  status        TEXT NOT NULL DEFAULT 'invited'
                  CHECK (status IN ('invited', 'in_progress', 'submitted', 'received')),
  form_progress JSONB NOT NULL DEFAULT '{}',
  -- shape: { "bank": "completed", "application": "in_progress", ... }
  -- updated by the candidate portal on each form sign; status strings only.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
