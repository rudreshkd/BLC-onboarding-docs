import './helpers/dom.js';
import { mockFetch, clearSession } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { request, setToken, getToken, setUnauthorizedHandler, ApiError } from '../js/api.js';

beforeEach(() => clearSession());

test('attaches Bearer token + JSON content-type, parses JSON', async () => {
  setToken('hr-jwt');
  const calls = mockFetch(() => ({ status: 200, headers: { 'content-type': 'application/json' }, json: { ok: 1 } }));
  const out = await request('/invites');
  assert.deepEqual(out, { ok: 1 });
  assert.equal(calls[0].url, 'http://localhost:3000/invites');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer hr-jwt');
});

test('POST body serializes to JSON with content-type', async () => {
  setToken('hr-jwt');
  const calls = mockFetch(() => ({ status: 201, headers: { 'content-type': 'application/json' }, json: { inviteId: 'x' } }));
  await request('/invites', { method: 'POST', body: { email: 'a@b.com' } });
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].opts.body, JSON.stringify({ email: 'a@b.com' }));
});

test('401 clears the token, fires the unauthorized handler, and throws', async () => {
  setToken('expired');
  let fired = 0;
  setUnauthorizedHandler(() => { fired += 1; });
  mockFetch(() => ({ status: 401 }));
  await assert.rejects(() => request('/invites'), (e) => e instanceof ApiError && e.status === 401);
  assert.equal(getToken(), null, 'token cleared on 401');
  assert.equal(fired, 1, 'handler fired');
  setUnauthorizedHandler(() => {});
});

test('network failure throws ApiError with status 0', async () => {
  global.fetch = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(() => request('/invites'), (e) => e instanceof ApiError && e.status === 0);
});

test('204 returns null', async () => {
  setToken('t');
  mockFetch(() => ({ status: 204 }));
  assert.equal(await request('/packs/x/receipt', { method: 'POST' }), null);
});
