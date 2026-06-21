// submit.js — build and upload the completed pack to HR (TASK 2.3)
//
// The candidate's browser builds the foldered ZIP and PUTs it over HTTPS. The
// server encrypts the pack at rest with a managed KMS key and gates HR download
// behind authentication + audit (Phase 3). No encryption keys are handled in the
// browser — HR never custodies a key file.
//
// The relay endpoint (PUT /packs/{id}) arrives with the Phase 3 backend. Until
// then submitPackToHR returns { status: 'no-backend' } so the candidate journey
// still completes locally; the real upload lights up when the backend deploys.

import { state, API_BASE } from './state.js';
import { buildZip } from './downloads.js';

// Returns one of:
//   { status: 'uploaded' }    — pack PUT to the relay successfully
//   { status: 'no-backend' }  — relay route not deployed; complete locally
//   { status: 'offline' }     — browser is offline; caller retries on reconnect
// Throws only on a real upload failure against a reachable relay (caller toasts).
export async function submitPackToHR() {
  if (navigator.onLine === false) return { status: 'offline' };

  const zipBlob = await buildZip(true); // foldered structure
  const inviteId = state.session?.inviteId;

  let res;
  try {
    res = await fetch(`${API_BASE}/packs/${inviteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
        'Authorization': `Bearer ${state.session?.token}`,
      },
      body: zipBlob,
    });
  } catch {
    return { status: 'no-backend' }; // network/route absent — relay not deployed
  }

  // A static host (no relay yet) answers PUT with 404/405/501. Treat those as
  // "backend not deployed" so the demo completes; a deployed relay's 5xx is a
  // genuine error the caller surfaces and we keep the draft.
  if (res.status === 404 || res.status === 405 || res.status === 501) {
    return { status: 'no-backend' };
  }
  if (!res.ok) throw new Error('Upload failed');
  return { status: 'uploaded' };
}
