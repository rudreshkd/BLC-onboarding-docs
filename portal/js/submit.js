// submit.js — build, encrypt, and upload the completed pack to HR (TASK 2.3)
//
// Sequence: build the foldered ZIP → fetch HR's public key → envelope-encrypt →
// PUT the ciphertext to the relay. The candidate's browser only ever holds the
// public key, so the pack is unreadable to anyone but HR.
//
// The relay and key endpoints (GET /keys/hr-public, PUT /packs/{id}) arrive with
// the Phase 3 backend. Until then submitPackToHR returns { status: 'no-backend' }
// so the candidate journey still completes locally; the real upload lights up the
// moment the backend is deployed, with no further client changes.

import { state } from './state.js';
import { buildZip } from './downloads.js';
import { fetchHRPublicKey, encryptPack, serialiseEncrypted } from './crypto.js';

// Build the foldered ZIP and envelope-encrypt it. Returns the serialised payload
// ArrayBuffer, or null if HR's public key isn't available yet (backend absent).
async function buildEncryptedPayload() {
  const zipBlob = await buildZip(true);
  const zipBuffer = await zipBlob.arrayBuffer();

  let hrPublicKey;
  try {
    hrPublicKey = await fetchHRPublicKey();
  } catch {
    return null; // key endpoint not deployed yet
  }

  const encrypted = await encryptPack(zipBuffer, hrPublicKey);
  return serialiseEncrypted(encrypted);
}

// Returns one of:
//   { status: 'uploaded' }    — encrypted pack PUT to the relay successfully
//   { status: 'no-backend' }  — relay/key endpoint not deployed; complete locally
//   { status: 'offline' }     — browser is offline; caller retries on reconnect
// Throws only on a real upload failure against a reachable relay (caller shows a toast).
export async function submitPackToHR() {
  if (navigator.onLine === false) return { status: 'offline' };

  const payload = await buildEncryptedPayload();
  if (!payload) return { status: 'no-backend' };

  const inviteId = state.session?.inviteId;
  const res = await fetch(`/packs/${inviteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': `Bearer ${state.session?.token}`,
    },
    body: payload,
  });
  if (!res.ok) throw new Error('Upload failed');
  return { status: 'uploaded' };
}
