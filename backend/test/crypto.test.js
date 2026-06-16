// crypto.test.js — envelope crypto + local storage/KMS adapters.

import './helpers/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { aesGcmEncrypt, aesGcmDecrypt } from '../src/crypto/envelope.js';
import { getKms } from '../src/adapters/kms/index.js';
import { getStorage } from '../src/adapters/storage/index.js';

test('AES-GCM round-trips plaintext', () => {
  const key = randomBytes(32);
  const plain = Buffer.from('the quick brown fox 🦊');
  const { iv, ciphertext } = aesGcmEncrypt(plain, key);
  assert.ok(!ciphertext.equals(plain), 'ciphertext must differ from plaintext');
  const out = aesGcmDecrypt(iv, ciphertext, key);
  assert.deepEqual(out, plain);
});

test('AES-GCM rejects a wrong key (auth tag)', () => {
  const { iv, ciphertext } = aesGcmEncrypt(Buffer.from('secret'), randomBytes(32));
  assert.throws(() => aesGcmDecrypt(iv, ciphertext, randomBytes(32)));
});

test('AES-GCM rejects a non-32-byte key', () => {
  assert.throws(() => aesGcmEncrypt(Buffer.from('x'), randomBytes(16)));
});

test('local KMS generateDataKey + decrypt round-trips the data key', async () => {
  const kms = getKms();
  const { plaintext, wrapped } = await kms.generateDataKey();
  assert.equal(plaintext.length, 32);
  assert.ok(!wrapped.equals(plaintext), 'wrapped key must not equal plaintext');
  const unwrapped = await kms.decrypt(wrapped);
  assert.deepEqual(unwrapped, plaintext);
});

test('local storage put/get/delete round-trips an envelope', async () => {
  const storage = getStorage();
  const key = 'test-invite-' + Math.random().toString(36).slice(2);
  const obj = {
    iv: randomBytes(12),
    ciphertext: randomBytes(64),
    wrappedDataKey: randomBytes(60),
  };
  await storage.put(key, obj);
  const got = await storage.get(key);
  assert.deepEqual(got.iv, obj.iv);
  assert.deepEqual(got.ciphertext, obj.ciphertext);
  assert.deepEqual(got.wrappedDataKey, obj.wrappedDataKey);

  await storage.delete(key);
  assert.equal(await storage.get(key), null, 'get after delete must be null');
  await storage.delete(key); // idempotent — must not throw
});
