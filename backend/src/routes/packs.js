// routes/packs.js — encrypted pack relay (TASK 3.3 + receipt from 3.4).
//
//   PUT  /packs/:id          (candidate) upload ZIP ─► encrypt at rest ─► 204
//   GET  /packs/:id          (HR)        decrypt ─► stream ZIP
//   POST /packs/:id/receipt  (HR)        purge object ─► status=received ─► 204
//
// Fastify footguns handled here (review finding): the default body parser is
// JSON-only with a 1 MB cap. We register an application/zip → Buffer parser
// scoped to THIS plugin (encapsulated, so other routes still parse JSON) and a
// 50 MB bodyLimit. Over-limit ─► 413; non-zip content-type ─► 415.

import { requireAuth } from '../auth/guard.js';
import { getStorage } from '../adapters/storage/index.js';
import { getKms } from '../adapters/kms/index.js';
import { aesGcmEncrypt, aesGcmDecrypt } from '../crypto/envelope.js';
import { writeAudit } from '../audit.js';
import { notifyPackReady } from '../notifications/stub.js';
import { query } from '../db.js';
import { config } from '../config.js';

export default async function packRoutes(fastify) {
  // Raw-body parser for ZIP uploads, scoped to this plugin only.
  fastify.addContentTypeParser(
    'application/zip',
    { parseAs: 'buffer', bodyLimit: config.maxPackBytes },
    (_req, body, done) => done(null, body),
  );

  // --- PUT /packs/:id (candidate) ---------------------------------------------
  fastify.put(
    '/packs/:id',
    { preHandler: requireAuth('candidate'), bodyLimit: config.maxPackBytes },
    async (req, reply) => {
      const { id } = req.params;
      if (req.user.sub !== id) return reply.code(403).send({ error: 'Forbidden' });

      const contentType = (req.headers['content-type'] || '').toLowerCase();
      if (!contentType.startsWith('application/zip')) {
        return reply.code(415).send({ error: 'Content-Type must be application/zip' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return reply.code(400).send({ error: 'Empty body' });
      }
      // Verify the bytes are actually a ZIP (local file header 'PK\x03\x04' or
      // empty-archive 'PK\x05\x06') — Content-Type alone is caller-asserted.
      if (req.body.length < 4 || req.body[0] !== 0x50 || req.body[1] !== 0x4b) {
        return reply.code(400).send({ error: 'Body is not a valid ZIP archive' });
      }

      // Envelope encrypt: fresh data key per pack, AES-256-GCM the ZIP, store wrapped key.
      const kms = getKms();
      const { plaintext: dataKey, wrapped: wrappedDataKey } = await kms.generateDataKey();
      const { iv, ciphertext } = aesGcmEncrypt(req.body, dataKey);
      await getStorage().put(id, { iv, ciphertext, wrappedDataKey });

      await query(
        `UPDATE invites SET status = 'submitted', updated_at = NOW()
          WHERE id = $1 AND status <> 'received'`,
        [id],
      );
      await writeAudit(id, 'pack_submitted', 'candidate');
      notifyPackReady(id); // fire-and-forget stub (Phase 5)
      return reply.code(204).send();
    },
  );

  // --- GET /packs/:id (HR) ----------------------------------------------------
  fastify.get('/packs/:id', { preHandler: requireAuth('hr') }, async (req, reply) => {
    const { id } = req.params;
    const stored = await getStorage().get(id);
    if (!stored) return reply.code(404).send({ error: 'Pack not found' });

    const dataKey = await getKms().decrypt(stored.wrappedDataKey);
    const zip = aesGcmDecrypt(stored.iv, stored.ciphertext, dataKey);

    await writeAudit(id, 'pack_downloaded', `hr:${req.user.sub}`);
    return reply.type('application/zip').send(zip);
  });

  // --- POST /packs/:id/receipt (HR) -------------------------------------------
  fastify.post('/packs/:id/receipt', { preHandler: requireAuth('hr') }, async (req, reply) => {
    const { id } = req.params;
    await getStorage().delete(id); // idempotent
    const { rows } = await query(
      `UPDATE invites SET status = 'received', updated_at = NOW()
        WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Invite not found' });

    await writeAudit(id, 'pack_received', `hr:${req.user.sub}`);
    await writeAudit(id, 'pack_purged', `hr:${req.user.sub}`);
    return reply.code(204).send();
  });
}
