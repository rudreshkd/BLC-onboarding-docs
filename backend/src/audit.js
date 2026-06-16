// audit.js — append-only audit trail writer.
//
//   writeAudit(inviteId, event, actor)
//
// Best-effort within the request: a failed audit insert should not 500 the
// primary action, but it is logged. Callers may await or fire-and-forget.

import { query } from './db.js';

export async function writeAudit(inviteId, event, actor) {
  try {
    await query(
      'INSERT INTO audit_log (invite_id, event, actor) VALUES ($1, $2, $3)',
      [inviteId ?? null, event, actor ?? null],
    );
  } catch (err) {
    console.error(`audit write failed (${event}):`, err.message);
  }
}
