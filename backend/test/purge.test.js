// purge.test.js — scheduled metadata purge (TASK 3.5).

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureSchema, truncateAll, closeDb, seedInvite, query } from './helpers/app.js';
import { purge } from '../scripts/purge-old-invites.js';

before(async () => { await ensureSchema(); });
beforeEach(async () => { await truncateAll(); });
after(async () => { await closeDb(); });

async function ageInvite(id, days) {
  await query("UPDATE invites SET updated_at = NOW() - ($2 || ' days')::interval WHERE id = $1", [id, String(days)]);
}

test('purge removes a 35-day-old received invite and writes a scheduled_purge audit row', async () => {
  const invite = await seedInvite({ status: 'received' });
  await ageInvite(invite.id, 35);

  const { invitesDeleted } = await purge();
  assert.equal(invitesDeleted, 1);

  const { rows } = await query('SELECT count(*)::int AS n FROM invites WHERE id = $1', [invite.id]);
  assert.equal(rows[0].n, 0);
  const { rows: audit } = await query("SELECT count(*)::int AS n FROM audit_log WHERE event = 'scheduled_purge'");
  assert.ok(audit[0].n >= 1);
});

test('purge leaves a recent received invite and a non-received old invite alone', async () => {
  const recent = await seedInvite({ status: 'received' });
  await ageInvite(recent.id, 5);
  const oldButSubmitted = await seedInvite({ status: 'submitted' });
  await ageInvite(oldButSubmitted.id, 100);

  const { invitesDeleted } = await purge();
  assert.equal(invitesDeleted, 0);
});

test('purge on an empty/ineligible DB deletes nothing and does not error', async () => {
  const { invitesDeleted, tokensDeleted } = await purge();
  assert.equal(invitesDeleted, 0);
  assert.equal(tokensDeleted, 0);
});

test('purge is idempotent (second run also deletes the now-absent invite count = 0)', async () => {
  const invite = await seedInvite({ status: 'received' });
  await ageInvite(invite.id, 40);
  const first = await purge();
  assert.equal(first.invitesDeleted, 1);
  const second = await purge();
  assert.equal(second.invitesDeleted, 0);
});
