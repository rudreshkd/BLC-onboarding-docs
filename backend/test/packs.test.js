// packs.test.js — encrypted pack relay (TASK 3.3 + receipt).

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  buildServer, ensureSchema, truncateAll, closeDb,
  seedInvite, query, hrToken, candidateToken, auditEvents,
} from './helpers/app.js';
import { getStorage } from '../src/adapters/storage/index.js';
import { config } from '../src/config.js';

let app;
before(async () => { await ensureSchema(); app = buildServer(); await app.ready(); });
beforeEach(async () => { await truncateAll(); });
after(async () => { await app.close(); await closeDb(); });

const ZIP_CT = { 'content-type': 'application/zip' };

async function putPack(inviteId, buf, token) {
  return app.inject({
    method: 'PUT', url: `/packs/${inviteId}`,
    headers: { ...ZIP_CT, authorization: `Bearer ${token}` },
    payload: buf,
  });
}

test('PUT then GET round-trips byte-identical, and stores ciphertext (not the raw zip)', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const zip = randomBytes(2048); // opaque "zip" bytes

  const put = await putPack(invite.id, zip, candidateToken(invite.id));
  assert.equal(put.statusCode, 204);

  // status moved to submitted + audited
  const { rows } = await query('SELECT status FROM invites WHERE id = $1', [invite.id]);
  assert.equal(rows[0].status, 'submitted');
  assert.ok((await auditEvents(invite.id)).some((e) => e.event === 'pack_submitted'));

  // at rest = ciphertext, not the plaintext zip
  const stored = await getStorage().get(invite.id);
  assert.ok(stored, 'object must exist at rest');
  assert.ok(!stored.ciphertext.equals(zip), 'stored bytes must be ciphertext, not the raw zip');

  // HR GET decrypts to the exact original bytes
  const get = await app.inject({ method: 'GET', url: `/packs/${invite.id}`, headers: { authorization: `Bearer ${hrToken()}` } });
  assert.equal(get.statusCode, 200);
  assert.equal(get.headers['content-type'], 'application/zip');
  assert.ok(get.rawPayload.equals(zip), 'GET must return byte-identical zip');
  assert.ok((await auditEvents(invite.id)).some((e) => e.event === 'pack_downloaded'));
});

test('PUT rejects a wrong sub (403)', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const put = await putPack(invite.id, randomBytes(16), candidateToken('00000000-0000-0000-0000-000000000000'));
  assert.equal(put.statusCode, 403);
});

test('PUT rejects a non-zip content-type (415)', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const res = await app.inject({
    method: 'PUT', url: `/packs/${invite.id}`,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${candidateToken(invite.id)}` },
    payload: { not: 'a zip' },
  });
  assert.equal(res.statusCode, 415);
});

test('PUT rejects an over-limit body (413)', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  const tooBig = Buffer.alloc(config.maxPackBytes + 1, 1);
  const res = await putPack(invite.id, tooBig, candidateToken(invite.id));
  assert.equal(res.statusCode, 413);
});

test('GET requires an HR JWT (candidate or none → 401)', async () => {
  const invite = await seedInvite({ status: 'submitted' });
  const none = await app.inject({ method: 'GET', url: `/packs/${invite.id}` });
  assert.equal(none.statusCode, 401);
  const cand = await app.inject({ method: 'GET', url: `/packs/${invite.id}`, headers: { authorization: `Bearer ${candidateToken(invite.id)}` } });
  assert.equal(cand.statusCode, 403);
});

test('receipt purges the object, flips status to received, and GET then 404s', async () => {
  const invite = await seedInvite({ status: 'in_progress' });
  await putPack(invite.id, randomBytes(512), candidateToken(invite.id));

  const receipt = await app.inject({ method: 'POST', url: `/packs/${invite.id}/receipt`, headers: { authorization: `Bearer ${hrToken()}` } });
  assert.equal(receipt.statusCode, 204);

  assert.equal(await getStorage().get(invite.id), null, 'object must be purged');
  const { rows } = await query('SELECT status FROM invites WHERE id = $1', [invite.id]);
  assert.equal(rows[0].status, 'received');
  const events = await auditEvents(invite.id);
  assert.ok(events.some((e) => e.event === 'pack_received'));
  assert.ok(events.some((e) => e.event === 'pack_purged'));

  const get = await app.inject({ method: 'GET', url: `/packs/${invite.id}`, headers: { authorization: `Bearer ${hrToken()}` } });
  assert.equal(get.statusCode, 404);
});
