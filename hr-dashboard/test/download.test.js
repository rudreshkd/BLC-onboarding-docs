import './helpers/dom.js';
import { mockFetch, resetBody, clearSession, DASHBOARD_HTML } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { downloadPack, hasPack, fileFromPack, _clearCache } from '../js/download.js';
import { setToken } from '../js/api.js';

beforeEach(() => { clearSession(); resetBody(DASHBOARD_HTML); _clearCache(); });

// Minimal JSZip stub: loadAsync → object with a file(name) lookup.
function stubJSZip(entries = {}) {
  global.JSZip = {
    loadAsync: async () => ({
      file: (q) => {
        if (typeof q === 'string') return entries[q] || null;
        // regex basename lookup → return array of matches (download.js uses [0])
        return Object.keys(entries).filter((k) => q.test(k)).map((k) => entries[k]);
      },
    }),
  };
}

test('downloadPack GETs the pack, saves it, and caches the parsed ZIP', async () => {
  setToken('hr');
  stubJSZip();
  const calls = mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  assert.equal(hasPack('inv1'), false);
  await downloadPack('inv1', 'Sarah Okonkwo');
  assert.equal(calls[0].url, 'http://localhost:3000/packs/inv1');
  assert.equal(hasPack('inv1'), true, 'pack cached after download');
});

test('downloadPack surfaces a 404 (purged pack)', async () => {
  setToken('hr');
  mockFetch(() => ({ status: 404 }));
  await assert.rejects(() => downloadPack('gone', 'X'), (e) => e.status === 404);
  assert.equal(hasPack('gone'), false);
});

test('fileFromPack throws when the pack is not cached', async () => {
  await assert.rejects(() => fileFromPack('nope', 'Bank_Details.html'), /not downloaded/);
});

test('fileFromPack finds an entry by basename inside category folders', async () => {
  setToken('hr');
  mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));
  const entry = { async: async () => new Blob(['x']) };
  stubJSZip({ 'Personal Details/Bank_Details.html': entry });
  await downloadPack('inv2', 'X');
  await assert.doesNotReject(() => fileFromPack('inv2', 'Bank_Details.html'));
});
