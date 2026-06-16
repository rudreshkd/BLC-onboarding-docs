import './helpers/dom.js';
import { mockFetch, clearSession } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { login, signOut, isLoggedIn } from '../js/auth.js';
import { getToken } from '../js/api.js';

beforeEach(() => clearSession());

test('login stores the returned token', async () => {
  mockFetch(() => ({ status: 200, headers: { 'content-type': 'application/json' }, json: { token: 'hr-jwt' } }));
  await login('hr@brighterliving.co.uk', 'pw');
  assert.equal(getToken(), 'hr-jwt');
  assert.equal(isLoggedIn(), true);
});

test('wrong credentials (401) throw and store no token', async () => {
  mockFetch(() => ({ status: 401 }));
  await assert.rejects(() => login('hr@brighterliving.co.uk', 'bad'), (e) => e.status === 401);
  assert.equal(getToken(), null);
  assert.equal(isLoggedIn(), false);
});

test('signOut clears the token', async () => {
  mockFetch(() => ({ status: 200, headers: { 'content-type': 'application/json' }, json: { token: 't' } }));
  await login('a@b.com', 'pw');
  signOut();
  assert.equal(isLoggedIn(), false);
});
