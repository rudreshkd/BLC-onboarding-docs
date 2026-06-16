// routes/auth.js — magic-link issue + verify (TASK 3.2).
//
//   POST /auth/invite-link  (internal; HR dashboard issues a link)
//     invite exists & status='invited' ─► issue token ─► { link }
//
//   POST /auth/verify  (public; portal hits this on page load with ?token=)
//     hash(token) found & unused & unexpired
//       ─► mark used_at, mint candidate JWT, return { sessionToken, inviteId, offerTerms }
//     else ─► 401

import { query } from '../db.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth } from '../auth/guard.js';
import { hashToken, issueMagicLinkToken } from '../auth/tokens.js';
import { writeAudit } from '../audit.js';
import { notifyMagicLink } from '../notifications/stub.js';

export default async function authRoutes(fastify) {
  // --- POST /auth/invite-link (HR only — internal link issuance) --------------
  fastify.post('/auth/invite-link', { preHandler: requireAuth('hr') }, async (req, reply) => {
    const { inviteId } = req.body || {};
    if (!inviteId) return reply.code(400).send({ error: 'inviteId is required' });

    const { rows } = await query('SELECT id, status FROM invites WHERE id = $1', [inviteId]);
    const invite = rows[0];
    if (!invite) return reply.code(404).send({ error: 'Invite not found' });
    if (invite.status !== 'invited') {
      return reply.code(409).send({ error: `Invite status is '${invite.status}', expected 'invited'` });
    }

    const { link } = await issueMagicLinkToken(inviteId);
    await writeAudit(inviteId, 'link_sent', 'system');
    notifyMagicLink(inviteId, link); // fire-and-forget stub
    return reply.send({ link });
  });

  // --- POST /auth/verify ------------------------------------------------------
  fastify.post('/auth/verify', async (req, reply) => {
    const { token } = req.body || {};
    if (!token) return reply.code(400).send({ error: 'token is required' });

    const tokenHash = hashToken(token);
    // Atomically consume: only succeeds if unused and unexpired.
    const { rows } = await query(
      `UPDATE magic_link_tokens
         SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING invite_id`,
      [tokenHash],
    );
    const consumed = rows[0];
    if (!consumed) {
      return reply.code(401).send({ error: 'Link expired or already used' });
    }

    const { rows: inviteRows } = await query(
      'SELECT id, email, role, offer_terms FROM invites WHERE id = $1',
      [consumed.invite_id],
    );
    const invite = inviteRows[0];
    if (!invite) return reply.code(401).send({ error: 'Link expired or already used' });

    // First successful verify moves an 'invited' candidate to 'in_progress'.
    await query(
      `UPDATE invites SET status = 'in_progress', updated_at = NOW()
       WHERE id = $1 AND status = 'invited'`,
      [invite.id],
    );

    const sessionToken = signToken({
      sub: invite.id,
      email: invite.email,
      role: 'candidate',
    });
    await writeAudit(invite.id, 'link_verified', 'candidate');

    return reply.send({
      sessionToken,
      inviteId: invite.id,
      offerTerms: { role: invite.role, ...invite.offer_terms },
    });
  });
}
