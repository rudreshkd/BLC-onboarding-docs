// migrate.js — idempotent SQL migration runner (TASK 3.1, D1).
//
// Replaces the spec's `psql -f` approach (psql isn't guaranteed present, and a
// pg-based runner is portable to CI / containers / managed Postgres). Applies
// every migrations/*.sql in filename order, each inside its own transaction,
// and records applied filenames in schema_migrations so re-runs are no-ops.
//
//   run: npm run migrate
//
//   for each file in sorted(migrations/*.sql):
//     already in schema_migrations? ─► skip
//     else ─► BEGIN; run file; INSERT name; COMMIT  (rollback on error)

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, closePool } from '../src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedSet() {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

export async function migrate() {
  await ensureTrackingTable();
  const done = await appliedSet();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied += 1;
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  console.log(`migrations complete — ${applied} applied, ${files.length - applied} already up to date`);
  return applied;
}

// Run directly (node scripts/migrate.js) but stay importable from tests.
const isMain = process.argv[1] && process.argv[1].endsWith('migrate.js');
if (isMain) {
  migrate()
    .then(() => closePool())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
