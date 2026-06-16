// index.js — service entrypoint.

import { buildServer } from './server.js';
import { config } from './config.js';

const fastify = buildServer({ logger: true });

fastify.listen({ port: config.port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Invite & Identity Service listening on ${address}`);
});
