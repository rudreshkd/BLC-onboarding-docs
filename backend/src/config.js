// config.js — environment loading + validation.
//
// Reads a backend/.env file if present (no dependency: a tiny parser), then
// layers process.env on top. Fails fast on missing required vars so the
// service never boots half-configured.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env loader — KEY=VALUE per line, # comments, no interpolation.
// Existing process.env always wins (so tests/CI can override).
function loadDotEnv() {
  const path = join(__dirname, '..', '.env');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return; // no .env file — rely on process.env (CI, prod)
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // strip optional surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv();

function required(name) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtTtl: process.env.JWT_TTL || '8h',

  hr: {
    email: process.env.HR_EMAIL || '',
    passwordHash: process.env.HR_PASSWORD_HASH || '',
    userId: process.env.HR_USER_ID || 'hr-admin',
  },

  storageDriver: process.env.STORAGE_DRIVER || 'local',
  kmsDriver: process.env.KMS_DRIVER || 'local',
  localStorageDir: process.env.LOCAL_STORAGE_DIR || './data/packs',
  localKmsMasterKey: process.env.LOCAL_KMS_MASTER_KEY || '',

  port: Number(process.env.PORT || 3000),
  portalBaseUrl: process.env.PORTAL_BASE_URL || 'https://onboarding.brighterliving.co.uk',
  hrNotifyEmail: process.env.HR_NOTIFY_EMAIL || '',

  // Max pack upload size — 50 MB per TASK 3.3.
  maxPackBytes: 50 * 1024 * 1024,
  // Total number of onboarding forms (mirrors portal FORMS registry).
  formsTotal: 15,
};
