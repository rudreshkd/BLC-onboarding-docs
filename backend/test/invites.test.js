// invites.test.js — invite CRUD + progress (TASK 3.4).

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildServer, ensureSchema, truncateAll, closeDb,
  seedInvite, query, hrToken, candidateToken,
} from './helpers/app.js';

let app;
const HR = () => ({ authorization: `Bearer ${hrToken()}` });
before(async () => { await ensureSchema(); app = buildServer(); await app.ready(); });
beforeEach(async () => { await truncateAll(); });
after(async () => { await app.close(); await closeDb(); });

test('POST /invites requires an HR JWT', async () => {
  const res = await app.inject({ method: 'POST', url: '/invites', payload: { email: 'x@y.com', role: 'Support Worker' } });
  assert.equal(res.statusCode, 401);
});

test('POST /invites creates an invite that appears in GET /invites', async () => {
  const create = await app.inject({
    method: 'POST', url: '/invites', headers: HR(),
    payload: { email: 'sarah@example.com', role: 'Support Worker', offerTerms: { salary: '£12.71/hr' } },
  });
  assert.equal(create.statusCode, 201);
  const { inviteId } = create.json();
  assert.ok(inviteId);

  const list = await app.inject({ method: 'GET', url: '/invites', headers: HR() });
  assert.equal(list.statusCode, 200);
  const invites = list.json();
  const found = invites.find((i) => i.id === inviteId);
  assert.ok(found);
  assert.equal(found.status, 'invited');
  assert.equal(found.formsComplete, 0);
  assert.equal(found.formsTotal, 15);
});

test('POST /invites 400s without email/role', async () => {
  const res = await app.inject({ method: 'POST', url: '/invites', headers: HR(), payload: { email: 'x@y.com' } });
  assert.equal(res.statusCode, 400);
});

test('PATCH progress increments formsComplete and rejects a wrong sub', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const tok = candidateToken(invite.id);

  // wrong sub → 403
  const wrong = await app.inject({
    method: 'PATCH', url: `/invites/${invite.id}/progress`,
    headers: { authorization: `Bearer ${candidateToken('00000000-0000-0000-0000-000000000000')}` },
    payload: { formId: 'bank', status: 'completed' },
  });
  assert.equal(wrong.statusCode, 403);

  const ok = await app.inject({
    method: 'PATCH', url: `/invites/${invite.id}/progress`,
    headers: { authorization: `Bearer ${tok}` },
    payload: { formId: 'bank', status: 'completed' },
  });
  assert.equal(ok.statusCode, 204);

  const list = await app.inject({ method: 'GET', url: '/invites', headers: HR() });
  const found = list.json().find((i) => i.id === invite.id);
  assert.equal(found.formsComplete, 1);
  assert.equal(found.formProgress.bank, 'completed');
});

test('PATCH progress rejects an out-of-enum status', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const res = await app.inject({
    method: 'PATCH', url: `/invites/${invite.id}/progress`,
    headers: { authorization: `Bearer ${candidateToken(invite.id)}` },
    payload: { formId: 'bank', status: 'pwned' },
  });
  assert.equal(res.statusCode, 400);
});

test('PATCH all 15 forms flips status to submitted', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const tok = candidateToken(invite.id);
  const forms = ['application','staffDetails','staffProfile','bank','hmrc','health','hepb','covid','gdpr','confidentiality','criminal','wtd','offer','supervision','reg19'];
  for (const f of forms) {
    await app.inject({ method: 'PATCH', url: `/invites/${invite.id}/progress`, headers: { authorization: `Bearer ${tok}` }, payload: { formId: f, status: 'completed' } });
  }
  const { rows } = await query('SELECT status FROM invites WHERE id = $1', [invite.id]);
  assert.equal(rows[0].status, 'submitted');
});

test('POST /invites/:id/remind re-issues a token for an in_progress invite', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const res = await app.inject({ method: 'POST', url: `/invites/${invite.id}/remind`, headers: HR() });
  assert.equal(res.statusCode, 204);
  const { rows } = await query('SELECT count(*)::int AS n FROM magic_link_tokens WHERE invite_id = $1', [invite.id]);
  assert.equal(rows[0].n, 1);
});

test('POST /invites/:id/remind 409s for a received invite', async () => {
  const invite = await seedInvite({ status: 'received' });
  const res = await app.inject({ method: 'POST', url: `/invites/${invite.id}/remind`, headers: HR() });
  assert.equal(res.statusCode, 409);
});
