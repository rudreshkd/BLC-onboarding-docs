// dashboard.js — metrics band + candidate tracking matrix + polling (4.1/4.2).
//
//   poll loop: every 30s, skip if a fetch is in-flight or the tab is hidden.
//   render is derived from GET /invites + the in-memory pack cache (hasPack),
//   so re-rendering after a download flips "Confirm Receipt" on with no state.

import { request } from './api.js';
import { escH, formatDate, nameFromEmail } from './util.js';
import { showToast } from './toast.js';
import { downloadPack, hasPack } from './download.js';
import { openRecord } from './inspector.js';

const POLL_MS = 30000;
let pollTimer = null;
let inFlight = false;
let invites = [];
let wired = false;

export function computeMetrics(list) {
  return {
    total: list.length,
    pendingReview: list.filter((i) => i.status === 'submitted').length,
    received: list.filter((i) => i.status === 'received').length,
  };
}

export function statusLabel(status) {
  return {
    invited: 'Invited', in_progress: 'In progress',
    submitted: 'Submitted', received: 'Received',
  }[status] || status;
}

// Which action buttons a row shows, by status (pure — unit tested).
// `downloaded` gates Confirm Receipt (revealed only after a pack download).
export function actionsFor(status, downloaded = false) {
  switch (status) {
    case 'invited':
    case 'in_progress':
      return ['resend'];
    case 'submitted':
      return downloaded ? ['download', 'resend', 'receipt'] : ['download', 'resend'];
    case 'received':
      return ['view'];
    default:
      return [];
  }
}

const ACTION_LABEL = {
  resend: 'Resend link', download: 'Download Pack',
  receipt: 'Confirm Receipt', view: 'View record',
};

function actionButtonsHTML(invite) {
  return actionsFor(invite.status, hasPack(invite.id))
    .map((act) => {
      const primary = act === 'download' ? 'btn-primary' : 'btn-secondary';
      return `<button class="btn btn-sm ${primary}" data-act="${act}">${ACTION_LABEL[act]}</button>`;
    })
    .join('');
}

export function rowHTML(invite) {
  const pct = invite.formsTotal ? Math.round((invite.formsComplete / invite.formsTotal) * 100) : 0;
  return `<tr data-id="${escH(invite.id)}">
    <td data-label="Candidate">${escH(nameFromEmail(invite.email))}</td>
    <td data-label="Role">${escH(invite.role)}</td>
    <td data-label="Submitted">${formatDate(invite.submittedAt)}</td>
    <td data-label="Progress">${invite.formsComplete}/${invite.formsTotal}<div class="bar"><i style="width:${pct}%"></i></div></td>
    <td data-label="Status"><span class="badge badge-${escH(invite.status)}">${escH(statusLabel(invite.status))}</span></td>
    <td data-label="Actions" class="row-actions">${actionButtonsHTML(invite)}</td>
  </tr>`;
}

function renderMetrics(m) {
  const cards = [
    ['Total Onboarding Candidates', m.total],
    ['Pending HR Reviews', m.pendingReview],
    ['Fully Received', m.received],
  ];
  document.getElementById('metrics').innerHTML = cards
    .map(([label, num]) => `<div class="metric-card"><div class="num">${num}</div><div class="label">${escH(label)}</div></div>`)
    .join('');
}

function renderMatrix(list) {
  const body = document.getElementById('matrix-body');
  const empty = document.getElementById('matrix-empty');
  if (!list.length) { body.innerHTML = ''; if (empty) empty.hidden = false; return; }
  if (empty) empty.hidden = true;
  body.innerHTML = list.map(rowHTML).join('');
}

export function render(list) {
  renderMetrics(computeMetrics(list));
  renderMatrix(list);
}

// Shimmer placeholder rows shown on the very first load (before data arrives).
// Background polls keep the existing rows, so this only fills the initial blank.
function renderSkeleton(rows = 4) {
  const empty = document.getElementById('matrix-empty');
  if (empty) empty.hidden = true;
  const cell = '<td><div class="skel">&nbsp;</div></td>';
  document.getElementById('matrix-body').innerHTML =
    Array.from({ length: rows }, () => `<tr class="skeleton-row">${cell.repeat(6)}</tr>`).join('');
}

async function onMatrixClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  const invite = invites.find((i) => i.id === id);
  if (!invite) return;
  const act = btn.dataset.act;

  try {
    if (act === 'resend') {
      await request(`/invites/${id}/remind`, { method: 'POST' });
      showToast(`Reminder sent to ${invite.email}`);
    } else if (act === 'download') {
      btn.disabled = true;
      btn.textContent = 'Downloading…';
      await downloadPack(id, nameFromEmail(invite.email));
      showToast('Pack downloaded');
      render(invites); // reveals Confirm Receipt now that hasPack() is true
    } else if (act === 'receipt') {
      // Irreversible: server-side purge. Guard before firing.
      if (!window.confirm(
        'Confirm receipt of this pack? This permanently deletes it from the relay. '
        + 'Make sure you have downloaded it first — this cannot be undone.')) return;
      btn.disabled = true;
      btn.textContent = 'Confirming…';
      await request(`/packs/${id}/receipt`, { method: 'POST' });
      showToast('Pack received and purged from relay');
      await refresh(); // status → received
    } else if (act === 'view') {
      openRecord(invite);
    }
  } catch (err) {
    if (err.status !== 401) showToast(err.message || 'Action failed');
    render(invites);
  }
}

export async function refresh() {
  if (inFlight) return; // single-in-flight guard — no stacked polls
  inFlight = true;
  try {
    invites = await request('/invites');
    render(invites);
  } catch (err) {
    if (err.status !== 401) showToast('Could not refresh candidates');
  } finally {
    inFlight = false;
  }
}

function wireOnce() {
  if (wired) return;
  document.getElementById('matrix-body').addEventListener('click', onMatrixClick);
  wired = true;
}

export function startDashboard() {
  wireOnce();
  renderSkeleton(); // fill the initial blank while the first fetch runs
  refresh();
  pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
}

export function stopDashboard() {
  clearInterval(pollTimer);
  pollTimer = null;
}

// Test seam.
export function _setInvites(list) { invites = list; }
