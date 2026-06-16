// auth.test.js — magic-link issue + verify (TASK 3.2).

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildServer, ensureSchema, truncateAll, closeDb,
  seedInvite, seedToken, query, hashToken, auditEvents,
} from './helpers/app.js';

let app;
before(async () => { await ensureSchema(); app = buildServer(); await app.ready(); });
beforeEach(async () => { await truncateAll(); });
after(async () => { await app.close(); await closeDb(); });

// --- POST /auth/invite-link ---------------------------------------------------
test('invite-link 404s for an unknown invite', async () => {
  const res = await app.inject({ method: 'POST', url: '/auth/invite-link', payload: { inviteId: '00000000-0000-0000-0000-000000000000' } });
  assert.equal(res.statusCode, 404);
});

test('invite-link 409s when status is not invited', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const res = await app.inject({ method: 'POST', url: '/auth/invite-link', payload: { inviteId: invite.id } });
  assert.equal(res.statusCode, 409);
});

test('invite-link issues a token + link for an invited candidate', async () => {
  const invite = await seedInvite();
  const res = await app.inject({ method: 'POST', url: '/auth/invite-link', payload: { inviteId: invite.id } });
  assert.equal(res.statusCode, 200);
  const { link } = res.json();
  assert.match(link, /\/\?token=[a-f0-9]{64}$/);
  const { rows } = await query('SELECT count(*)::int AS n FROM magic_link_tokens WHERE invite_id = $1', [invite.id]);
  assert.equal(rows[0].n, 1);
});

// --- POST /auth/verify --------------------------------------------------------
test('verify returns a session token + offer terms for a fresh token', async () => {
  const invite = await seedInvite({ role: 'Care Assistant' });
  const raw = await seedToken(invite.id);
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { token: raw } });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.inviteId, invite.id);
  assert.ok(body.sessionToken);
  assert.equal(body.offerTerms.role, 'Care Assistant');
  // status advanced to in_progress
  const { rows } = await query('SELECT status FROM invites WHERE id = $1', [invite.id]);
  assert.equal(rows[0].status, 'in_progress');
  const events = await auditEvents(invite.id);
  assert.ok(events.some((e) => e.event === 'link_verified'));
});

test('verify rejects a reused token (single use)', async () => {
  const invite = await seedInvite();
  const raw = await seedToken(invite.id);
  const first = await app.inject({ method: 'POST', url: '/auth/verify', payload: { token: raw } });
  assert.equal(first.statusCode, 200);
  const second = await app.inject({ method: 'POST', url: '/auth/verify', payload: { token: raw } });
  assert.equal(second.statusCode, 401);
});

test('verify rejects an expired token', async () => {
  const invite = await seedInvite();
  const raw = await seedToken(invite.id, { expiresInDays: -1 });
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { token: raw } });
  assert.equal(res.statusCode, 401);
});

test('verify rejects an unknown token', async () => {
  const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { token: 'nope' } });
  assert.equal(res.statusCode, 401);
});
