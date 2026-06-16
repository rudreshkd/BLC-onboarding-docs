// notifications/stub.js — no-op notification stubs (Phase 5 replaces these).
//
// TASK 3.4 / 3.3 call these; TASK 5.1 / 5.2 swap in real Postmark/SES sends.
// Kept async + swallow-safe so callers can fire-and-forget without affecting
// the critical path.

export async function notifyMagicLink(_inviteId, _link) {
  // Phase 5: send the magic-link email to the candidate.
}

export async function notifyPackReady(_inviteId) {
  // Phase 5: email HR that a pack is ready for review.
}
