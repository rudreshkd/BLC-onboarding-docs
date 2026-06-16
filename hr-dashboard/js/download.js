// download.js — authenticated pack download (TASK 2.4) + in-memory ZIP cache.
//
// The server decrypts and streams the ZIP (no client-side keys). We save the
// whole ZIP AND keep it parsed in memory so the record inspector (4.3) can pull
// individual form files without re-downloading.
//
//   downloadPack(id, name)  GET /packs/:id → save .zip → cache JSZip
//   fileFromPack(id, path)  read one entry from the cached ZIP → save it
//   hasPack(id)             is a decrypted ZIP cached this session?

import { request } from './api.js';

// Map<inviteId, JSZip> — one care home, one pack open at a time in practice.
const packCache = new Map();

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

// GET the decrypted pack, save it, and cache the parsed ZIP. 401 is handled by
// api.js (clears token + redirect). Returns the JSZip instance.
export async function downloadPack(inviteId, candidateName) {
  const res = await request(`/packs/${inviteId}`, { raw: true });
  const buf = await res.arrayBuffer();
  const safeName = String(candidateName || 'Candidate').replace(/[^\w-]+/g, '_');
  saveBlob(new Blob([buf], { type: 'application/zip' }), `Brighter_Living_${safeName}_Onboarding_Pack.zip`);

  const zip = await JSZip.loadAsync(buf);
  packCache.set(inviteId, zip);
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
export function _clearCache() { packCache.clear(); }
