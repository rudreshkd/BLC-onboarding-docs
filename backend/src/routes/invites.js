// routes/invites.js — invite CRUD for the HR dashboard + candidate progress (TASK 3.4).
//
//   POST  /invites               (HR)        create invite ─► 201 { inviteId }
//   GET   /invites               (HR)        list with computed formsComplete
//   PATCH /invites/:id/progress  (candidate) merge one form's status
//   POST  /invites/:id/remind    (HR)        re-issue magic link
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
    const { email, role, offerTerms } = req.body || {};
    if (!email || !role) {
      return reply.code(400).send({ error: 'email and role are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: 'email is not a valid address' });
    }
    const { rows } = await query(
      `INSERT INTO invites (email, role, offer_terms, status, form_progress)
       VALUES ($1, $2, $3, 'invited', '{}'::jsonb)
       RETURNING id`,
      [email, role, JSON.stringify(offerTerms || {})],
    );
    const inviteId = rows[0].id;
    await writeAudit(inviteId, 'invite_created', `hr:${req.user.sub}`);
    notifyMagicLink(inviteId); // fire-and-forget stub (Phase 5)
    return reply.code(201).send({ inviteId });
  });

  // --- GET /invites (HR) ------------------------------------------------------
  fastify.get('/invites', { preHandler: requireAuth('hr') }, async (_req, reply) => {
    const { rows } = await query(
      `SELECT id, email, role, status, offer_terms, form_progress, created_at, updated_at
         FROM invites
       ORDER BY created_at DESC`,
    );
    const invites = rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      status: r.status,
      formProgress: r.form_progress,
      formsComplete: countCompleted(r.form_progress),
      formsTotal: config.formsTotal,
      offerTerms: r.offer_terms,
      submittedAt: r.status === 'submitted' || r.status === 'received' ? r.updated_at : null,
      createdAt: r.created_at,
    }));
    return reply.send(invites);
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

  // --- POST /invites/:id/remind (HR) ------------------------------------------
  fastify.post('/invites/:id/remind', { preHandler: requireAuth('hr') }, async (req, reply) => {
    const { id } = req.params;
    const { rows } = await query('SELECT id, status FROM invites WHERE id = $1', [id]);
    const invite = rows[0];
    if (!invite) return reply.code(404).send({ error: 'Invite not found' });
    if (invite.status !== 'invited' && invite.status !== 'in_progress') {
      return reply.code(409).send({ error: `Cannot remind an invite with status '${invite.status}'` });
    }

    const { link } = await issueMagicLinkToken(id);
    await writeAudit(id, 'link_sent', `hr:${req.user.sub}`);
    notifyMagicLink(id, link); // fire-and-forget stub
    return reply.code(204).send();
  });
}
