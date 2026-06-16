// purge-old-invites.js — scheduled metadata purge (TASK 3.5).
//
//   run: node scripts/purge-old-invites.js
//
// Deploy-scheduled, NOT a standing guarantee (review OV-E): retention only
// fires when a scheduler invokes this. Suggested cron: 0 2 * * *.
//
// Idempotent — running twice produces the same result:
//   1. delete 'received' invites older than 30 days (cascades to tokens;
//      audit_log rows are de-linked via ON DELETE SET NULL, preserved)
//   2. delete orphaned expired tokens not removed by cascade
//   3. always write a 'scheduled_purge' audit row

import { pool, closePool } from '../src/db.js';

export async function purge() {
  const { rowCount: invitesDeleted } = await pool.query(`
    DELETE FROM invites
     WHERE status = 'received'
       AND updated_at < NOW() - INTERVAL '30 days'
  `);

  const { rowCount: tokensDeleted } = await pool.query(`
    DELETE FROM magic_link_tokens
     WHERE expires_at < NOW() - INTERVAL '30 days'
       AND invite_id NOT IN (SELECT id FROM invites)
  `);

  await pool.query(`
    INSERT INTO audit_log (event, actor)
    VALUES ('scheduled_purge', 'system')
  `);

  console.log(`Purged ${invitesDeleted} invites, ${tokensDeleted} orphaned tokens`);
  return { invitesDeleted, tokensDeleted };
}

const isMain = process.argv[1] && process.argv[1].endsWith('purge-old-invites.js');
if (isMain) {
  purge()
    .then(() => closePool())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
