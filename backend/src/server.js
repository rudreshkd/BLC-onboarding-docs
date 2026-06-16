// server.js — Fastify app assembly.
//
// buildServer() returns a configured (not-yet-listening) Fastify instance so
// tests can drive it via fastify.inject() with no open port. Each route group
// is its own encapsulated plugin (keeps the application/zip parser scoped to
// /packs, and keeps route registration out of one shared file — review flag).

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import hrRoutes from './routes/hr.js';
import inviteRoutes from './routes/invites.js';
import packRoutes from './routes/packs.js';

export function buildServer(opts = {}) {
  const fastify = Fastify({ logger: opts.logger ?? false });

  // CORS (D1): only the allowlisted portal/dashboard origins may call the API.
  // No `credentials` — auth is Bearer JWT, not cookies. Requests with no Origin
  // (curl, server-to-server) are allowed through (origin: false → no ACAO).
  fastify.register(cors, {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  fastify.get('/health', async () => ({ status: 'ok' }));

  fastify.register(authRoutes);
  fastify.register(hrRoutes);
  fastify.register(inviteRoutes);
  fastify.register(packRoutes);

  return fastify;
}
