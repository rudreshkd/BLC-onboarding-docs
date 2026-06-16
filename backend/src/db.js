// db.js — single shared Postgres connection pool.

import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Thin query helper so callers don't import `pool` directly everywhere.
export function query(text, params) {
  return pool.query(text, params);
}

export async function closePool() {
  await pool.end();
}
