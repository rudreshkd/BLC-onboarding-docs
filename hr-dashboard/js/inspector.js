// inspector.js — slide-in candidate record panel (TASK 4.3).
//
// Shows per-form STATUS from invite.formProgress (status strings only — the
// backend has no per-form timestamps, D3) grouped by the 5 categories, plus the
// overall submittedAt + progress.
//
// Two-step gate on the footer actions:
//   Review Documents      — disabled until every form is complete.
//   Complete and Download — disabled until Review Documents has run (pack cached).

import { escH, formatDate, displayName } from './util.js';
import { showToast } from './toast.js';
import { hasPack, fileFromPack, downloadPack, reviewPack } from './download.js';
import { FORMS, CATEGORIES } from './forms.js';

let current = null; // the invite currently shown

function statusMark(status) {
  if (status === 'completed') return '<span class="tick">Completed</span>';
  if (status === 'in_progress') return '<span class="dash">In progress</span>';
  return '<span class="none">Not started</span>';
}

export function recordHTML(invite) {
  const reviewed = hasPack(invite.id);
  const allFormsComplete = invite.formsTotal > 0 && invite.formsComplete === invite.formsTotal;
  const purged = invite.status === 'received' && !reviewed;

  const groups = CATEGORIES.map((cat) => {
    const rows = FORMS.filter((f) => f.category === cat).map((f) => {
      const st = invite.formProgress?.[f.id];
      return `<div class="form-row"><span>${escH(f.name)}</span>${statusMark(st)}</div>`;
    }).join('');
    return `<div class="cat-group"><h3>${escH(cat)}</h3>${rows}</div>`;
  }).join('');

  const reviewDisabled = purged
    ? 'disabled title="Pack purged from relay"'
    : !allFormsComplete
      ? 'disabled title="All forms must be completed before you can review"'
      : '';
  const completeDisabled = purged
    ? 'disabled title="Pack purged from relay"'
    : !reviewed
      ? 'disabled title="Review the documents first"'
      : '';

  return `
    <button class="btn btn-sm btn-secondary" data-act="close">Back</button>
    <h2>${escH(displayName(invite))} — ${escH(invite.role)}</h2>
    <p class="muted">Status: ${escH(invite.status)} · Submitted: ${formatDate(invite.submittedAt)}</p>
    <p>Progress: ${invite.formsComplete} / ${invite.formsTotal} forms complete</p>
    ${groups}
    <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary" data-act="review" ${reviewDisabled}>Review Documents</button>
      <button class="btn btn-primary" data-act="complete-download" ${completeDisabled}>Complete and Download ↓</button>
    </div>`;
}

function close() {
  document.getElementById('inspector').hidden = true;
  document.getElementById('inspector-scrim').hidden = true;
  current = null;
  // Lets the dashboard table pick up anything that changed while open (e.g. a
  // pack download here reveals Confirm Receipt back in the row).
  window.dispatchEvent(new CustomEvent('inspector-closed'));
}

async function onClick(e) {
  const btn = e.target.closest('button');
  if (!btn || !current) return;

  if (btn.dataset.act === 'close') return close();

  try {
    if (btn.dataset.act === 'review') {
      await reviewPack(current.id);
      await fileFromPack(current.id, 'All_Forms_Combined.html');
      showToast('Documents reviewed');
      openRecord(current); // re-render: Complete and Download now enabled
    } else if (btn.dataset.act === 'complete-download') {
      await downloadPack(current.id, displayName(current));
      showToast('Pack downloaded');
      openRecord(current);
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
