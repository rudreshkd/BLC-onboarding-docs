// auth/tokens.js — magic-link token hashing + issuance (DRY).
//
// Used by both POST /auth/invite-link and POST /invites/:id/remind. We store
// only the SHA-256 hash of the raw token; the raw token is returned once (to be
// emailed) and never persisted.
//
//   issueMagicLinkToken(inviteId)
//     ─► raw = randomBytes(32).hex
//     ─► INSERT { invite_id, token_hash: sha256(raw), expires_at: NOW()+7d }
//     ─► return { raw, link }

import { randomBytes, createHash } from 'node:crypto';
import { query } from '../db.js';
import { config } from '../config.js';

export function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

// Issues a fresh 7-day single-use token for an invite. Returns the raw token
// and the full magic-link URL (the Notification Service emails the link).
export async function issueMagicLinkToken(inviteId) {
  const raw = randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  await query(
    `INSERT INTO magic_link_tokens (invite_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [inviteId, tokenHash],
  );
  const link = `${config.portalBaseUrl}/?token=${raw}`;
  return { raw, link };
}
