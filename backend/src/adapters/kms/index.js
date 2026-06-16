// adapters/kms/index.js — KMS adapter selector (D2).
//
// KmsAdapter interface:
//   generateDataKey() ─► Promise<{ plaintext: Buffer(32), wrapped: Buffer }>
//   decrypt(wrapped: Buffer) ─► Promise<Buffer(32)>
//
// Selected by KMS_DRIVER. Only 'local' ships now; 'aws' is deferred to deploy
// (would lazy-import @aws-sdk/client-kms so dev never needs the SDK installed).

import { config } from '../../config.js';
import { createLocalKms } from './local.js';

let instance;

export function getKms() {
  if (instance) return instance;
  switch (config.kmsDriver) {
    case 'local':
      instance = createLocalKms();
      break;
    case 'aws':
      throw new Error('KMS_DRIVER=aws is deferred to the deploy phase (D2) — not yet implemented');
    default:
      throw new Error(`Unknown KMS_DRIVER: ${config.kmsDriver}`);
  }
  return instance;
}

// Test seam: reset the memoised instance (e.g. after changing env in tests).
export function _resetKms() {
  instance = undefined;
}
