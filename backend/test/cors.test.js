// cors.test.js — CORS allowlist (D1, pulled forward from TASK 6.3).

import './helpers/env.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

let app;
before(async () => { app = buildServer(); await app.ready(); });
after(async () => { await app.close(); });

test('allowed origin gets an access-control-allow-origin header', async () => {
  const res = await app.inject({
    method: 'GET', url: '/health',
    headers: { origin: 'http://localhost:8080' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:8080');
});

test('a preflight from an allowed origin is permitted', async () => {
  const res = await app.inject({
    method: 'OPTIONS', url: '/invites',
    headers: {
      origin: 'http://localhost:8080',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type',
    },
  });
  assert.ok(res.statusCode === 204 || res.statusCode === 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:8080');
});

test('a disallowed origin gets NO access-control-allow-origin header', async () => {
  const res = await app.inject({
    method: 'GET', url: '/health',
    headers: { origin: 'https://evil.example.com' },
  });
  // Request still succeeds server-side, but the browser blocks it because no ACAO.
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});
