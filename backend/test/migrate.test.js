// migrate.test.js — migration runner idempotency (TASK 3.1).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, query, closeDb } from './helpers/app.js';

before(async () => { await migrate(); });
after(async () => { await closeDb(); });

test('running migrate again is a no-op (idempotent)', async () => {
  const applied = await migrate();
  assert.equal(applied, 0, 'already-applied migrations must not re-run');
});

test('all three tables exist and are queryable', async () => {
  for (const t of ['invites', 'magic_link_tokens', 'audit_log']) {
    await assert.doesNotReject(query(`SELECT count(*) FROM ${t}`));
  }
});

test('form_progress accepts empty and populated jsonb', async () => {
  const { rows } = await query(
    `INSERT INTO invites (email, role, offer_terms, form_progress)
     VALUES ('a@b.com', 'Support Worker', '{}'::jsonb, '{"bank":"completed","application":"in_progress"}'::jsonb)
     RETURNING form_progress`,
  );
  assert.equal(rows[0].form_progress.bank, 'completed');
  await query('TRUNCATE invites CASCADE');
});
