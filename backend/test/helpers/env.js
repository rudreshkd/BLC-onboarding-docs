// test/helpers/env.js — sets test environment BEFORE any src module loads.
//
// MUST be the first import in every helper/test that touches src, because
// src/config.js reads + validates env at module-evaluation time. ESM evaluates
// imported modules in source order, so importing this (which has no src deps)
// first guarantees process.env is populated before config.js runs.

import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const HR_PASSWORD = 'test-hr-password';

process.env.DATABASE_URL ||= 'postgres://localhost:5432/bl_onboarding_test';
process.env.JWT_SECRET ||= 'test-jwt-secret-not-for-prod';
process.env.JWT_TTL ||= '8h';
process.env.STORAGE_DRIVER ||= 'local';
process.env.KMS_DRIVER ||= 'local';
process.env.LOCAL_STORAGE_DIR ||= join(tmpdir(), `bl-test-packs-${process.pid}`);
process.env.LOCAL_KMS_MASTER_KEY ||= randomBytes(32).toString('base64');
process.env.HR_EMAIL ||= 'hr@brighterliving.co.uk';
process.env.HR_PASSWORD_HASH ||= bcrypt.hashSync(HR_PASSWORD, 10);
process.env.HR_USER_ID ||= 'hr-admin';
process.env.PORTAL_BASE_URL ||= 'https://onboarding.test';
