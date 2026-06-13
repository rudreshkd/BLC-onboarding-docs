// crypto.js — envelope encryption using the Web Crypto API (TASK 2.2)
//
// A random 256-bit AES-GCM "content key" encrypts the pack. That content key is
// then wrapped with HR's RSA-OAEP 4096-bit public key, so only the holder of the
// matching private key (generated in hr-keygen.html) can ever read the pack.
// The candidate's browser never sees a decryption key.

const RSA_ALGO = { name: 'RSA-OAEP', hash: 'SHA-256' };
const IV_BYTES = 12; // 96-bit GCM nonce

/* ---------- base64 <-> bytes ---------- */

function b64ToBytes(b64) {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export { bytesToB64 }; // handy for tests / hr-keygen parity

/* ---------- public key import ---------- */

// Import a raw RSA-OAEP public key from a base64 SPKI string.
export async function importPublicKey(base64spki) {
  const spki = b64ToBytes(base64spki);
  return crypto.subtle.importKey('spki', spki, RSA_ALGO, true, ['encrypt']);
}

// Fetch HR's public key from the server endpoint GET /keys/hr-public.
// Accepts either a JSON body ({ publicKey | key | spki }) or a bare base64 string.
export async function fetchHRPublicKey() {
  const res = await fetch('/keys/hr-public');
  if (!res.ok) throw new Error(`Could not fetch HR public key (${res.status})`);
  const contentType = res.headers.get('content-type') || '';
  let b64;
  if (contentType.includes('application/json')) {
    const j = await res.json();
    b64 = j.publicKey || j.key || j.spki;
  } else {
    b64 = await res.text();
  }
  if (!b64) throw new Error('HR public key response was empty');
  return importPublicKey(b64);
}

/* ---------- envelope encryption ---------- */

// Envelope-encrypt an ArrayBuffer (or Uint8Array):
//   1. Generate a random 256-bit AES-GCM content key
//   2. Encrypt the payload with AES-GCM (fresh 96-bit IV)
//   3. Wrap the AES key with HR's RSA-OAEP public key
//   4. Return { wrappedKey, iv, ciphertext } — all Uint8Array
export async function encryptPack(plaintext, hrPublicKey) {
  const data = plaintext instanceof Uint8Array ? plaintext : new Uint8Array(plaintext);

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);

  const rawAes = await crypto.subtle.exportKey('raw', aesKey); // 32 bytes
  const wrappedBuf = await crypto.subtle.encrypt(RSA_ALGO, hrPublicKey, rawAes);

  return {
    wrappedKey: new Uint8Array(wrappedBuf),
    iv,
    ciphertext: new Uint8Array(ciphertextBuf),
  };
}

/* ---------- wire format ---------- */
// Layout: [4 bytes wrappedKey length, big-endian][wrappedKey][12 bytes IV][ciphertext]

export function serialiseEncrypted({ wrappedKey, iv, ciphertext }) {
  if (iv.length !== IV_BYTES) throw new Error(`IV must be ${IV_BYTES} bytes`);
  const out = new Uint8Array(4 + wrappedKey.length + IV_BYTES + ciphertext.length);
  new DataView(out.buffer).setUint32(0, wrappedKey.length, false); // big-endian length prefix
  let off = 4;
  out.set(wrappedKey, off); off += wrappedKey.length;
  out.set(iv, off);         off += IV_BYTES;
  out.set(ciphertext, off);
  return out.buffer;
}

export function deserialiseEncrypted(buffer) {
  const bytes = new Uint8Array(buffer);
  const wrappedLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  let off = 4;
  const wrappedKey = bytes.slice(off, off + wrappedLen); off += wrappedLen;
  const iv = bytes.slice(off, off + IV_BYTES);           off += IV_BYTES;
  const ciphertext = bytes.slice(off);
  return { wrappedKey, iv, ciphertext };
}
