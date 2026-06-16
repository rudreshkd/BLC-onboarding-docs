// adapters/storage/index.js — storage adapter selector (D2).
//
// StorageAdapter interface (objects keyed by inviteId):
//   put(key, { iv, ciphertext, wrappedDataKey })  ─► Promise<void>
//   get(key)  ─► Promise<{ iv, ciphertext, wrappedDataKey } | null>
//   delete(key)  ─► Promise<void>   (idempotent)
//
// Selected by STORAGE_DRIVER. Only 'local' ships now; 's3' is deferred to
// deploy (would lazy-import @aws-sdk/client-s3).

import { config } from '../../config.js';
import { createLocalStorage } from './local.js';

let instance;

export function getStorage() {
  if (instance) return instance;
  switch (config.storageDriver) {
    case 'local':
      instance = createLocalStorage();
      break;
    case 's3':
      throw new Error('STORAGE_DRIVER=s3 is deferred to the deploy phase (D2) — not yet implemented');
    default:
      throw new Error(`Unknown STORAGE_DRIVER: ${config.storageDriver}`);
  }
  return instance;
}

export function _resetStorage() {
  instance = undefined;
}
