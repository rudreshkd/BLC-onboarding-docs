// earlyDetails.js — fetch + cache the 4 gating forms' decrypted answers
// (candidate details, Reg 19, Right to Work, DBS), sent early by the portal
// once those forms are all complete — see GET /invites/:id/early-details.
//
//   fetchEarlyDetails(id)  GET, cache on success, null on 404 (not sent yet)
//   earlyDetailsFor(id)    sync cache read for recordHTML()

import { request } from './api.js';

// Map<inviteId, details JSON> — only successful fetches are cached, so a
// candidate who hasn't finished the 4 gating forms yet is retried on every
// "View record" open rather than being stuck on a cached 404.
const cache = new Map();

export function earlyDetailsFor(inviteId) {
  return cache.get(inviteId) || null;
}

export async function fetchEarlyDetails(inviteId) {
  try {
    const data = await request(`/invites/${inviteId}/early-details`);
    cache.set(inviteId, data);
    return data;
  } catch (err) {
    if (err.status === 404) return null; // not sent yet — not an error state
    throw err;
  }
}

// Test seam.
export function _clearCache() { cache.clear(); }
