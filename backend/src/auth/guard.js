// auth/guard.js — requireAuth preHandler factory.
//
//   requireAuth()        ─► any valid JWT; attaches req.user = payload
//   requireAuth('hr')    ─► valid JWT AND role === 'hr', else 403
//   requireAuth('candidate') ─► valid JWT AND role === 'candidate'
//
// Missing/invalid token ─► 401. Wrong role ─► 403.

import { verifyToken, bearerFrom } from './jwt.js';

export function requireAuth(role) {
  return async function preHandler(req, reply) {
    const token = bearerFrom(req);
    if (!token) {
      return reply.code(401).send({ error: 'Missing bearer token' });
    }
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
    if (role && payload.role !== role) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    req.user = payload;
  };
}
