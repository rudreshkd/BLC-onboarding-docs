// server.js — Fastify app assembly.
//
// buildServer() returns a configured (not-yet-listening) Fastify instance so
// tests can drive it via fastify.inject() with no open port. Each route group
// is its own encapsulated plugin (keeps the application/zip parser scoped to
// /packs, and keeps route registration out of one shared file — review flag).

import Fastify from 'fastify';
import authRoutes from './routes/auth.js';
import hrRoutes from './routes/hr.js';
import inviteRoutes from './routes/invites.js';
import packRoutes from './routes/packs.js';

export function buildServer(opts = {}) {
  const fastify = Fastify({ logger: opts.logger ?? false });

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.register(authRoutes);
  fastify.register(hrRoutes);
  fastify.register(inviteRoutes);
  fastify.register(packRoutes);

  return fastify;
}
