// earlyDetails.js — sends the 4 gating forms' answers to HR as soon as they're
// all complete, so HR can review candidate details, Reg 19, Right to Work and
// DBS before the rest of the pack is done. Same fire-and-forget shape as
// signature.js's reportProgress(): failures are swallowed, and the caller
// (dashboard.js) just retries on the next renderDashboard() since the fields
// involved lock once completed, so the snapshot never goes stale.

import { state, API_BASE } from './state.js';

// Resolves true only on a real 204, so the caller doesn't latch "sent" on a
// failed attempt (offline, relay not deployed yet, etc.).
export async function submitEarlyDetailsToHR() {
  if (!state.session?.inviteId) return false;

  const payload = {
    profile: state.profile,
    reg19: state.submissions.reg19?.data ?? null,
    rightToWork: state.submissions.rightToWork?.data ?? null,
    dbs: state.submissions.dbs?.data ?? null,
  };

  try {
    const res = await fetch(`${API_BASE}/invites/${state.session.inviteId}/early-details`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.session.token}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false; // network/route absent — relay not deployed, or offline
  }
}
