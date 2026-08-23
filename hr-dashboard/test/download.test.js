import './helpers/dom.js';
import { mockFetch, resetBody, clearSession, DASHBOARD_HTML } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { downloadPack, reviewPack, hasPack, fileFromPack, _clearCache, _evictRawCache } from '../js/download.js';
import { setToken } from '../js/api.js';

beforeEach(() => { clearSession(); resetBody(DASHBOARD_HTML); _clearCache(); });

// Minimal JSZip stub: loadAsync → object with a file(name) lookup + generateAsync.
function stubJSZip(entries = {}) {
  global.JSZip = {
    loadAsync: async () => ({
      file: (q) => {
        if (typeof q === 'string') return entries[q] || null;
        // regex basename lookup → return array of matches (download.js uses [0])
        return Object.keys(entries).filter((k) => q.test(k)).map((k) => entries[k]);
      },
      generateAsync: async () => new ArrayBuffer(16),
    }),
  };
}

test('reviewPack GETs the pack and caches the parsed ZIP (no save)', async () => {
  setToken('hr');
  stubJSZip();
  const calls = mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  assert.equal(hasPack('inv1'), false);
  await reviewPack('inv1');
  assert.equal(calls[0].url, 'http://localhost:3000/packs/inv1');
  assert.equal(hasPack('inv1'), true, 'pack cached after review');
});

test('reviewPack does not re-fetch once cached', async () => {
  setToken('hr');
  stubJSZip();
  const calls = mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  await reviewPack('inv1');
  await reviewPack('inv1');
  assert.equal(calls.length, 1, 'second reviewPack call served from cache');
});

test('reviewPack surfaces a 404 (purged pack)', async () => {
  setToken('hr');
  mockFetch(() => ({ status: 404 }));
  await assert.rejects(() => reviewPack('gone'), (e) => e.status === 404);
  assert.equal(hasPack('gone'), false);
});

test('downloadPack throws when the pack has not been reviewed yet', async () => {
  await assert.rejects(() => downloadPack('never-reviewed', 'X'), /Review the documents/);
});

test('downloadPack saves the already-reviewed ZIP without re-fetching', async () => {
  setToken('hr');
  stubJSZip();
  const calls = mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  await reviewPack('inv1');
  await downloadPack('inv1', 'Sarah Okonkwo');
  assert.equal(calls.length, 1, 'downloadPack reused the reviewed pack, no extra fetch');
});

test('downloadPack falls back to zip.generateAsync() when the raw bytes are not cached', async () => {
  setToken('hr');
  let generateAsyncCalls = 0;
  global.JSZip = {
    loadAsync: async () => ({
      file: () => null,
      generateAsync: async () => { generateAsyncCalls++; return new ArrayBuffer(16); },
    }),
  };
  mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  await reviewPack('inv3');
  _evictRawCache('inv3'); // simulate a rawCache miss with packCache still populated
  await assert.doesNotReject(() => downloadPack('inv3', 'X'));
  assert.equal(generateAsyncCalls, 1, 'generateAsync fallback used when rawCache has no entry');
});

test('fileFromPack throws when the pack is not cached', async () => {
  await assert.rejects(() => fileFromPack('nope', 'Bank_Details.html'), /not downloaded/);
});

test('fileFromPack finds an entry by basename inside category folders', async () => {
  setToken('hr');
  mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  const entry = { async: async () => new Blob(['x']) };
  stubJSZip({ 'Personal Details/Bank_Details.html': entry });
  await reviewPack('inv2');
  await assert.doesNotReject(() => fileFromPack('inv2', 'Bank_Details.html'));
});
