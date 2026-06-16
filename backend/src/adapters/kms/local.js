// adapters/kms/local.js — local KMS implementation (D2: dev only).
//
// Mimics a cloud KMS GenerateDataKey/Decrypt envelope flow without any cloud
// dependency. A 32-byte master key (from env, base64) wraps per-pack data keys
// with AES-256-GCM. The wrapped key is opaque bytes the caller stores next to
// the ciphertext — exactly the shape a real KMS CiphertextBlob has.
//
//   generateDataKey() ─► { plaintext: <32B key>, wrapped: <iv|ct|tag> }
//   decrypt(wrapped)  ─► <32B plaintext key>
//
// Prod swaps this for adapters/kms/aws.js (kms:GenerateDataKey + kms:Decrypt);
// the CMK never leaves KMS. Deferred per D2 until deploy.

import { randomBytes } from 'node:crypto';
import { aesGcmEncrypt, aesGcmDecrypt } from '../../crypto/envelope.js';
import { config } from '../../config.js';

function masterKey() {
  if (!config.localKmsMasterKey) {
    throw new Error('LOCAL_KMS_MASTER_KEY is not set — required for the local KMS adapter');
  }
  const key = Buffer.from(config.localKmsMasterKey, 'base64');
  if (key.length !== 32) {
    throw new Error('LOCAL_KMS_MASTER_KEY must decode to 32 bytes (base64 of randomBytes(32))');
  }
  return key;
}

export function createLocalKms() {
  return {
    // Returns a fresh AES-256 data key plus its wrapped (KMS-encrypted) form.
    async generateDataKey() {
      const plaintext = randomBytes(32);
      const { iv, ciphertext } = aesGcmEncrypt(plaintext, masterKey());
      // wrapped blob = iv(12) || ciphertext+tag
      const wrapped = Buffer.concat([iv, ciphertext]);
      return { plaintext, wrapped };
    },

    // Unwraps a previously wrapped data key.
    async decrypt(wrapped) {
      const buf = Buffer.isBuffer(wrapped) ? wrapped : Buffer.from(wrapped);
      const iv = buf.subarray(0, 12);
      const ciphertext = buf.subarray(12);
      return aesGcmDecrypt(iv, ciphertext, masterKey());
    },
  };
}
