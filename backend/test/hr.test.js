// hr.test.js — HR login (TASK 4.1 pulled forward, D3).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { buildServer, ensureSchema, closeDb } from './helpers/app.js';
import { HR_PASSWORD } from './helpers/env.js';

let app;
before(async () => { await ensureSchema(); app = buildServer(); await app.ready(); });
after(async () => { await app.close(); await closeDb(); });

test('HR login with correct credentials returns a role:hr JWT', async () => {
  const res = await app.inject({
    method: 'POST', url: '/hr/auth/login',
    payload: { email: 'hr@brighterliving.co.uk', password: HR_PASSWORD },
  });
  assert.equal(res.statusCode, 200);
  const { token } = res.json();
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(decoded.role, 'hr');
  assert.equal(decoded.sub, 'hr-admin');
});

test('HR login with a wrong password returns 401', async () => {
  const res = await app.inject({
    method: 'POST', url: '/hr/auth/login',
    payload: { email: 'hr@brighterliving.co.uk', password: 'wrong' },
  });
  assert.equal(res.statusCode, 401);
});

test('HR login with a wrong email returns 401', async () => {
  const res = await app.inject({
    method: 'POST', url: '/hr/auth/login',
    payload: { email: 'nope@brighterliving.co.uk', password: HR_PASSWORD },
  });
  assert.equal(res.statusCode, 401);
});
