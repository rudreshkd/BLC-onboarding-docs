// draft.js — encrypted local draft using Web Crypto API (TASK 1.4)
// AES-GCM 256; key lives in sessionStorage (survives refresh, dies with the tab).
// IndexedDB stores only ciphertext — never plaintext.

const DB_NAME   = 'bl-draft';
const STORE     = 'session';
const KEY_STORE = 'bl-draft-key';

function b64encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64decode(s) {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getKey() {
  const stored = sessionStorage.getItem(KEY_STORE);
  if (stored) {
    return crypto.subtle.importKey('raw', b64decode(stored),
      { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  sessionStorage.setItem(KEY_STORE, b64encode(raw));
  return key;
}

async function encrypt(plaintext) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // fresh 96-bit IV per save
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return { iv: b64encode(iv), ciphertext: b64encode(ciphertext) };
}

async function decrypt(ivB64, ciphertextB64) {
  const key = await getKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(ivB64) }, key, b64decode(ciphertextB64));
  return new TextDecoder().decode(plain);
}

export async function saveDraft(stateObj) {
  try {
    const { iv, ciphertext } = await encrypt(JSON.stringify(stateObj));
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id: 'draft', iv, ciphertext });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Draft is quality-of-life only — never break the journey over a save failure.
  }
}

export async function loadDraft() {
  try {
    const db = await openDB();
    const record = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('draft');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!record) return null;
    return JSON.parse(await decrypt(record.iv, record.ciphertext));
  } catch {
    // Key gone (new session) or corrupt record — treat as no draft.
    return null;
  }
}

export async function clearDraft() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('draft');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* nothing to clear */ }
}
