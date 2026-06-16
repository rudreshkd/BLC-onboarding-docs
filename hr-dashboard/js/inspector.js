// inspector.js — slide-in candidate record panel (TASK 4.3).
//
// Shows per-form STATUS from invite.formProgress (status strings only — the
// backend has no per-form timestamps, D3) grouped by the 5 categories, plus the
// overall submittedAt + progress. Individual [Download] buttons are enabled only
// once the pack has been downloaded this session (served from the in-memory ZIP).

import { escH, formatDate, nameFromEmail } from './util.js';
import { showToast } from './toast.js';
import { hasPack, fileFromPack, downloadPack } from './download.js';
import { FORMS, CATEGORIES } from './forms.js';

let current = null; // the invite currently shown

function statusMark(status) {
  if (status === 'completed') return '<span class="tick">✓ Completed</span>';
  if (status === 'in_progress') return '<span class="dash">⏳ In progress</span>';
  return '<span class="none">— Not started</span>';
}

export function recordHTML(invite) {
  const downloaded = hasPack(invite.id);
  const groups = CATEGORIES.map((cat) => {
    const rows = FORMS.filter((f) => f.category === cat).map((f) => {
      const st = invite.formProgress?.[f.id];
      const dlBtn = `<button class="btn btn-sm btn-secondary" data-file="${escH(f.file)}" ${downloaded ? '' : 'disabled title="Download the pack first"'}>Download</button>`;
      return `<div class="form-row"><span>${escH(f.name)} ${statusMark(st)}</span>${dlBtn}</div>`;
    }).join('');
    return `<div class="cat-group"><h3>${escH(cat)}</h3>${rows}</div>`;
  }).join('');

  return `
    <button class="btn btn-sm btn-secondary" data-act="close">← Back</button>
    <h2>${escH(nameFromEmail(invite.email))} — ${escH(invite.role)}</h2>
    <p class="muted">Status: ${escH(invite.status)} · Submitted: ${formatDate(invite.submittedAt)}</p>
    <p>Progress: ${invite.formsComplete} / ${invite.formsTotal} forms complete</p>
    ${downloaded ? '' : '<p class="muted" style="font-size:13px">Download the pack to enable individual form downloads below.</p>'}
    ${groups}
    <div style="margin-top:18px">
      <button class="btn btn-primary" data-act="download-all" ${invite.status === 'received' && !downloaded ? 'disabled title="Pack purged from relay"' : ''}>Download full pack ↓</button>
    </div>`;
}

function close() {
  document.getElementById('inspector').hidden = true;
  document.getElementById('inspector-scrim').hidden = true;
  current = null;
}

async function onClick(e) {
  const btn = e.target.closest('button');
  if (!btn || !current) return;

  if (btn.dataset.act === 'close') return close();

  try {
    if (btn.dataset.act === 'download-all') {
      await downloadPack(current.id, nameFromEmail(current.email));
      showToast('Pack downloaded');
      openRecord(current); // re-render: individual downloads now enabled
    } else if (btn.dataset.file) {
      await fileFromPack(current.id, btn.dataset.file);
    }
  } catch (err) {
    if (err.status !== 401) showToast(err.message || 'Download failed');
  }
}

export function openRecord(invite) {
  current = invite;
  const panel = document.getElementById('inspector');
  panel.innerHTML = recordHTML(invite);
  panel.hidden = false;
  document.getElementById('inspector-scrim').hidden = false;
  // Wire once per open (innerHTML replaced each time, so (re)bind the panel).
  panel.onclick = onClick;
  document.getElementById('inspector-scrim').onclick = close;
}
