// adapters/storage/local.js — filesystem-backed object storage (D2: dev only).
//
// Stores each encrypted pack as a single JSON file under LOCAL_STORAGE_DIR,
// keyed by inviteId. The stored object is the envelope: { iv, ciphertext,
// wrappedDataKey } (all base64). Mirrors the shape an S3 object would hold.
//
//   put(key, obj)    ─► writes <dir>/<key>.json
//   get(key)         ─► parsed object, or null if absent (→ 404 upstream)
//   delete(key)      ─► removes the file (idempotent: missing is fine)

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { config } from '../../config.js';

function baseDir() {
  const dir = config.localStorageDir;
  return isAbsolute(dir) ? dir : join(process.cwd(), dir);
}

// Guard against path traversal — inviteId is a UUID, but be explicit.
function fileFor(key) {
  if (!/^[A-Za-z0-9._-]+$/.test(key)) {
    throw new Error(`invalid storage key: ${key}`);
  }
  return join(baseDir(), `${key}.json`);
}

export function createLocalStorage() {
  return {
    // obj: { iv: Buffer, ciphertext: Buffer, wrappedDataKey: Buffer }
    async put(key, obj) {
      await mkdir(baseDir(), { recursive: true });
      const serialised = JSON.stringify({
        iv: obj.iv.toString('base64'),
        ciphertext: obj.ciphertext.toString('base64'),
        wrappedDataKey: obj.wrappedDataKey.toString('base64'),
      });
      await writeFile(fileFor(key), serialised, 'utf8');
    },

    // Returns { iv, ciphertext, wrappedDataKey } as Buffers, or null if absent.
    async get(key) {
      let raw;
      try {
        raw = await readFile(fileFor(key), 'utf8');
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
      const o = JSON.parse(raw);
      return {
        iv: Buffer.from(o.iv, 'base64'),
        ciphertext: Buffer.from(o.ciphertext, 'base64'),
        wrappedDataKey: Buffer.from(o.wrappedDataKey, 'base64'),
      };
    },

    // Idempotent delete — purging an already-purged pack must not error.
    async delete(key) {
      await rm(fileFor(key), { force: true });
    },
  };
}
