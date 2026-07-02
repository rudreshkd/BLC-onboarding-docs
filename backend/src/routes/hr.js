// routes/hr.js — HR login (TASK 4.1, pulled forward to Phase 3 per D3).
//
//   POST /hr/auth/login  { email, password }
//     matches HR_EMAIL + bcrypt(HR_PASSWORD_HASH) ─► { token: <jwt role:hr> }
//     else ─► 401
//
// Single shared HR account for now (TASK 4.1 stub). TODO-4 tracks per-user HR
// accounts so audit_log.actor identifies who acted.

import bcrypt from 'bcryptjs';
import { signToken } from '../auth/jwt.js';
import { config } from '../config.js';

export default async function hrRoutes(fastify) {
  fastify.post('/hr/auth/login', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password are required' });
    }
    if (!config.hr.email || !config.hr.passwordHash) {
      return reply.code(500).send({ error: 'HR login is not configured' });
    }

    const emailOk = email === config.hr.email;
    const passwordOk = await bcrypt.compare(password, config.hr.passwordHash);
    // Compare both regardless to avoid leaking which field was wrong.
    if (!emailOk || !passwordOk) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = signToken({ sub: config.hr.userId, role: 'hr' });
    return reply.send({ token });
  });
}
