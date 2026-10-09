// routes/early-details.js — encrypted early-details relay for the 4 gating forms.
//
//   PUT /invites/:id/early-details  (candidate) encrypt at rest ─► 204
//   GET /invites/:id/early-details  (HR)        decrypt ─► JSON, 404 if not sent yet
//
// Same envelope-encryption pattern as packs.js (fresh data key per write, KMS-wrapped),
// just for a small JSON blob instead of a ZIP — no custom content-type parser needed,
// Fastify's default JSON parser (1 MB cap) is already enough for these 4 forms' answers.
// Stored under a distinct `${id}-early` key so it never collides with the full pack.

import { requireAuth } from '../auth/guard.js';
import { getStorage } from '../adapters/storage/index.js';
import { getKms } from '../adapters/kms/index.js';
import { aesGcmEncrypt, aesGcmDecrypt } from '../crypto/envelope.js';
import { writeAudit } from '../audit.js';

export default async function earlyDetailsRoutes(fastify) {
  // --- PUT /invites/:id/early-details (candidate) -----------------------------
  fastify.put('/invites/:id/early-details', { preHandler: requireAuth('candidate') }, async (req, reply) => {
    const { id } = req.params;
    if (req.user.sub !== id) return reply.code(403).send({ error: 'Forbidden' });

    const plaintext = Buffer.from(JSON.stringify(req.body || {}), 'utf8');
    const kms = getKms();
    const { plaintext: dataKey, wrapped: wrappedDataKey } = await kms.generateDataKey();
    const { iv, ciphertext } = aesGcmEncrypt(plaintext, dataKey);
    await getStorage().put(`${id}-early`, { iv, ciphertext, wrappedDataKey });

    await writeAudit(id, 'early_details_submitted', 'candidate');
    return reply.code(204).send();
  });

  // --- GET /invites/:id/early-details (HR) ------------------------------------
  fastify.get('/invites/:id/early-details', { preHandler: requireAuth('hr') }, async (req, reply) => {
    const { id } = req.params;
    const stored = await getStorage().get(`${id}-early`);
    if (!stored) return reply.code(404).send({ error: 'Not yet available' });

    const dataKey = await getKms().decrypt(stored.wrappedDataKey);
    const json = JSON.parse(aesGcmDecrypt(stored.iv, stored.ciphertext, dataKey).toString('utf8'));

    await writeAudit(id, 'early_details_viewed', `hr:${req.user.sub}`);
    return reply.send(json);
  });
}
