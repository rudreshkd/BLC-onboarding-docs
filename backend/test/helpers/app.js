// test/helpers/app.js — shared test harness.
//
// Imports env.js FIRST so config reads test values, then exposes the app,
// DB helpers, seeding, and token minting used across the suite.

import './env.js'; // must precede every src import below

import { buildServer } from '../../src/server.js';
import { pool, query } from '../../src/db.js';
import { signToken } from '../../src/auth/jwt.js';
import { hashToken } from '../../src/auth/tokens.js';
import { migrate } from '../../scripts/migrate.js';

export { pool, query, signToken, hashToken, migrate, buildServer };

// Run once per test file (idempotent) to ensure the schema exists.
export async function ensureSchema() {
  await migrate();
}

// Wipe data between tests; keeps schema + schema_migrations.
export async function truncateAll() {
  await query('TRUNCATE invites, magic_link_tokens, audit_log RESTART IDENTITY CASCADE');
}

export async function closeDb() {
  await pool.end();
}

// Insert an invite, return its row. Override any column via opts.
export async function seedInvite(opts = {}) {
  const {
    email = 'candidate@example.com',
    role = 'Support Worker',
    offerTerms = { startDate: 'TBC', salary: '£12.71/hr', hours: '35h', manager: 'Josiah Millar' },
    status = 'invited',
    formProgress = {},
  } = opts;
  const { rows } = await query(
    `INSERT INTO invites (email, role, offer_terms, status, form_progress)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [email, role, JSON.stringify(offerTerms), status, JSON.stringify(formProgress)],
  );
  return rows[0];
}

// Insert a magic-link token row directly. Returns the raw token.
export async function seedToken(inviteId, { raw = 'raw-token-' + Math.random().toString(36).slice(2), expiresInDays = 7 } = {}) {
  await query(
    `INSERT INTO magic_link_tokens (invite_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' days')::interval)`,
    [inviteId, hashToken(raw), String(expiresInDays)],
  );
  return raw;
}

export function candidateToken(inviteId, email = 'candidate@example.com') {
  return signToken({ sub: inviteId, email, role: 'candidate' });
}

export function hrToken(userId = 'hr-admin') {
  return signToken({ sub: userId, role: 'hr' });
}

export async function auditEvents(inviteId) {
  const { rows } = await query(
    'SELECT event, actor FROM audit_log WHERE invite_id = $1 ORDER BY id',
    [inviteId],
  );
  return rows;
}
