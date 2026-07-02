// download.js — authenticated pack download (TASK 2.4) + in-memory ZIP cache.
//
// The server decrypts and streams the ZIP (no client-side keys). Review and
// download are split into two steps so the inspector can require HR to review
// the documents before the pack can be saved to disk:
//
//   reviewPack(id)          GET /packs/:id → cache JSZip (no browser download)
//   downloadPack(id, name)  save the already-reviewed ZIP to disk
//   fileFromPack(id, path)  read one entry from the cached ZIP → save it
//   hasPack(id)             is a decrypted ZIP cached this session?

import { request } from './api.js';

// Map<inviteId, JSZip> — one care home, one pack open at a time in practice.
const packCache = new Map();
// Map<inviteId, ArrayBuffer> — the raw bytes GET-ed in reviewPack(), reused by
// downloadPack() so a repeat click doesn't pay to re-deflate the whole ZIP.
const rawCache = new Map();

export function hasPack(inviteId) {
  return packCache.has(inviteId);
}

// Trigger a browser download of a Blob under the given filename.
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// GET the decrypted pack and cache the parsed ZIP — this function itself never
// saves a file to disk (the "Review Documents" click that calls this does
// separately trigger a save, via fileFromPack pulling the combined doc).
// Returns the cached ZIP as-is if already fetched this session (401 is
// handled by api.js: clears token + redirect). Returns the JSZip instance.
export async function reviewPack(inviteId) {
  if (packCache.has(inviteId)) return packCache.get(inviteId);
  const res = await request(`/packs/${inviteId}`, { raw: true });
  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  packCache.set(inviteId, zip);
  rawCache.set(inviteId, buf);
  return zip;
}

// Save the already-reviewed ZIP to disk. Requires reviewPack() to have cached
// it first (enforced by the inspector's button gating) — the pack is never
// re-fetched here, since review already pulled it into memory. Reuses the raw
// bytes from reviewPack() rather than re-deflating the ZIP via generateAsync,
// so repeat clicks don't pay a CPU cost that scales with pack size.
export async function downloadPack(inviteId, candidateName) {
  const zip = packCache.get(inviteId);
  if (!zip) throw new Error('Review the documents before downloading the pack');
  const buf = rawCache.get(inviteId) || await zip.generateAsync({ type: 'arraybuffer' });
  const safeName = String(candidateName || 'Candidate').replace(/[^\w-]+/g, '_');
  saveBlob(new Blob([buf], { type: 'application/zip' }), `Brighter_Living_${safeName}_Onboarding_Pack.zip`);
  return zip;
}

// Save one file out of the cached ZIP, matched by filename (basename) so we
// don't depend on the pack's category-folder layout. Throws if the pack isn't
// cached or no entry matches (caller toasts).
export async function fileFromPack(inviteId, fileName) {
  const zip = packCache.get(inviteId);
  if (!zip) throw new Error('Pack not downloaded in this session');
  const entry = zip.file(fileName) // exact path
    || zip.file(new RegExp(`(^|/)${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))[0]; // by basename
  if (!entry) throw new Error(`File not found in pack: ${fileName}`);
  const blob = await entry.async('blob');
  saveBlob(blob, fileName);
}

// Test seam.
export function _clearCache() { packCache.clear(); rawCache.clear(); }
