// auth/jwt.js — sign/verify session JWTs.
//
// One JWT_SECRET signs both token kinds; the `role` claim discriminates them:
//   candidate: { sub: inviteId, email, role: 'candidate' }   (8h default)
//   hr:        { sub: hrUserId, role: 'hr' }
// The candidate `sub` is the inviteId — load-bearing: PUT /packs/:id checks
// sub === inviteId.

import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(payload, opts = {}) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtTtl, ...opts });
}

// Returns the decoded payload, or throws (caller maps to 401).
export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

// Pull a Bearer token out of an Authorization header. Returns null if absent.
export function bearerFrom(req) {
  const h = req.headers?.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}
