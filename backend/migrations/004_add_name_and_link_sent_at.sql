-- 004_add_name_and_link_sent_at.sql — candidate name + last link-sent timestamp.
--
-- name: HR types this when inviting; the dashboard previously had to guess a
--   display name from the email's local part.
-- link_sent_at: set whenever a magic link is issued (invite-link or remind),
--   so HR can see when the candidate was last sent a link.

ALTER TABLE invites ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS link_sent_at TIMESTAMPTZ;
