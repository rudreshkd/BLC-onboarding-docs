// routes/invites.js — invite CRUD for the HR dashboard + candidate progress (TASK 3.4).
//
//   POST   /invites               (HR)        create invite + issue magic link ─► 201 { inviteId, link }
//   GET    /invites               (HR)        list with computed formsComplete
//   DELETE /invites/:id           (HR)        permanently remove an invite
//   PATCH  /invites/:id/progress  (candidate) merge one form's status
//
// form_progress invariant: values are status strings from a fixed enum only —
// never form-answer PII. PATCH validates formId + status before merging.

import { query } from '../db.js';
import { requireAuth } from '../auth/guard.js';
import { issueMagicLinkToken } from '../auth/tokens.js';
import { writeAudit } from '../audit.js';
import { notifyMagicLink } from '../notifications/stub.js';
import { config } from '../config.js';

const PROGRESS_STATES = new Set(['in_progress', 'completed']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function countCompleted(formProgress) {
  return Object.values(formProgress || {}).filter((v) => v === 'completed').length;
}

export default async function inviteRoutes(fastify) {
  // --- POST /invites (HR) -----------------------------------------------------
  fastify.post('/invites', { preHandler: requireAuth('hr') }, async (req, reply) => {
    const { name, email, role, offerTerms } = req.body || {};
    if (!name || !email || !role) {
      return reply.code(400).send({ error: 'name, email and role are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: 'email is not a valid address' });
    }
    const { rows } = await query(
      `INSERT INTO invites (name, email, role, offer_terms, status, form_progress)
       VALUES ($1, $2, $3, $4, 'invited', '{}'::jsonb)
       RETURNING id`,
      [name, email, role, JSON.stringify(offerTerms || {})],
    );
    const inviteId = rows[0].id;
    await writeAudit(inviteId, 'invite_created', `hr:${req.user.sub}`);

    // Issue the magic link up front so HR can copy it straight into an email.
    // The raw token is returned once here and never persisted (only its hash is).
    const { link } = await issueMagicLinkToken(inviteId);
    await query('UPDATE invites SET link_sent_at = NOW() WHERE id = $1', [inviteId]);
    await writeAudit(inviteId, 'link_sent', `hr:${req.user.sub}`);
    notifyMagicLink(inviteId, link); // fire-and-forget stub (Phase 5)
    return reply.code(201).send({ inviteId, link });
  });

  // --- GET /invites (HR) ------------------------------------------------------
  fastify.get('/invites', { preHandler: requireAuth('hr') }, async (_req, reply) => {
    const { rows } = await query(
      `SELECT id, name, email, role, status, offer_terms, form_progress, link_sent_at, created_at, updated_at
         FROM invites
       ORDER BY created_at DESC`,
    );
    const invites = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      status: r.status,
      formProgress: r.form_progress,
      formsComplete: countCompleted(r.form_progress),
      formsTotal: config.formsTotal,
      offerTerms: r.offer_terms,
      submittedAt: r.status === 'submitted' || r.status === 'received' ? r.updated_at : null,
      linkSentAt: r.link_sent_at,
      createdAt: r.created_at,
    }));
    return reply.send(invites);
  });

  // --- DELETE /invites/:id (HR) ------------------------------------------------
  fastify.delete('/invites/:id', { preHandler: requireAuth('hr') }, async (req, reply) => {
    const { id } = req.params;
    const { rows: existing } = await query('SELECT id FROM invites WHERE id = $1', [id]);
    if (!existing[0]) return reply.code(404).send({ error: 'Invite not found' });
    // Write the audit row before deleting — its invite_id FK requires the invite
    // to still exist; ON DELETE SET NULL then de-links it once we delete below.
    await writeAudit(id, 'invite_deleted', `hr:${req.user.sub}`);
    await query('DELETE FROM invites WHERE id = $1', [id]);
    return reply.code(204).send();
  });

  // --- PATCH /invites/:id/progress (candidate) --------------------------------
  fastify.patch('/invites/:id/progress', { preHandler: requireAuth('candidate') }, async (req, reply) => {
    const { id } = req.params;
    if (req.user.sub !== id) return reply.code(403).send({ error: 'Forbidden' });

    const { formId, status } = req.body || {};
    if (!formId || typeof formId !== 'string') {
      return reply.code(400).send({ error: 'formId is required' });
    }
    if (!PROGRESS_STATES.has(status)) {
      return reply.code(400).send({ error: `status must be one of: ${[...PROGRESS_STATES].join(', ')}` });
    }

    // Shallow-merge one key into the jsonb map (status strings only).
    const { rows } = await query(
      `UPDATE invites
          SET form_progress = COALESCE(form_progress, '{}'::jsonb) || jsonb_build_object($2::text, $3::text),
              updated_at = NOW()
        WHERE id = $1
      RETURNING form_progress`,
      [id, formId, status],
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Invite not found' });

    // Belt-and-braces: all forms complete ─► mark submitted.
    if (countCompleted(rows[0].form_progress) >= config.formsTotal) {
      await query(
        `UPDATE invites SET status = 'submitted', updated_at = NOW()
          WHERE id = $1 AND status <> 'received'`,
        [id],
      );
    }

    await writeAudit(id, 'form_progress_updated', 'candidate');
    return reply.code(204).send();
  });
}
