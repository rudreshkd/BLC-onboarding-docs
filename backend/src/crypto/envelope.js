// envelope.js — AES-256-GCM payload encryption (TASK 3.3).
//
// THREAT MODEL (prod): envelope encryption protects pack contents against theft
// of the database, object storage, or backups at rest. It does NOT protect
// against a live-server compromise — the server necessarily holds the plaintext
// data key transiently to serve an authenticated GET. In production the data key
// is wrapped by a cloud KMS (KmsAdapter); the CMK never leaves KMS. In dev the
// local KMS wraps with a master key held in env — never written beside the
// ciphertext.
//
//   encrypt: plaintext + dataKey ─► { iv, ciphertext }   (auth tag appended to ct)
//   decrypt: { iv, ciphertext } + dataKey ─► plaintext
//
// GCM auth tag (16 bytes) is appended to the ciphertext so a tampered or
// wrong-key blob fails decryption loudly rather than returning garbage.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit IV, the GCM standard
const TAG_BYTES = 16;

// dataKey: 32-byte Buffer. plaintext: Buffer. Returns { iv, ciphertext } Buffers.
export function aesGcmEncrypt(plaintext, dataKey) {
  if (!Buffer.isBuffer(dataKey) || dataKey.length !== 32) {
    throw new Error('aesGcmEncrypt: dataKey must be a 32-byte Buffer');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, dataKey, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, ciphertext: Buffer.concat([enc, tag]) };
}

// iv, ciphertext: Buffers (ciphertext has the 16-byte tag appended). Returns plaintext Buffer.
export function aesGcmDecrypt(iv, ciphertext, dataKey) {
  if (!Buffer.isBuffer(dataKey) || dataKey.length !== 32) {
    throw new Error('aesGcmDecrypt: dataKey must be a 32-byte Buffer');
  }
  if (ciphertext.length < TAG_BYTES) {
    throw new Error('aesGcmDecrypt: ciphertext too short');
  }
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES);
  const enc = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, dataKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}
