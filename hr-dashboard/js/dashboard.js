// dashboard.js — metrics band + candidate tracking matrix + polling (4.1/4.2).
//
//   poll loop: every 30s, skip if a fetch is in-flight or the tab is hidden.
//   render is derived from GET /invites + the in-memory pack cache (hasPack),
//   so re-rendering after a download flips "Confirm Receipt" on with no state.

import { request } from './api.js';
import { escH, formatDate, displayName } from './util.js';
import { showToast } from './toast.js';
import { hasPack } from './download.js';
import { openRecord } from './inspector.js';

const POLL_MS = 30000;
let pollTimer = null;
let inFlight = false;
let invites = [];
let wired = false;
// Row menu (kebab): id of the invite the shared #row-menu dropdown currently
// targets, and the button that opened it (for aria-expanded + repositioning).
let menuOpenId = null;
let menuOpenBtn = null;

export function computeMetrics(list) {
  return {
    total: list.length,
    inProgress: list.filter((i) => i.status === 'in_progress').length,
    pendingReview: list.filter((i) => i.status === 'submitted').length,
    received: list.filter((i) => i.status === 'received').length,
  };
}

export function statusLabel(status) {
  return {
    invited: 'Invited', in_progress: 'In progress',
    submitted: 'To Review', received: 'Completed',
  }[status] || status;
}

// Which action buttons a row shows, by status (pure — unit tested).
// Download Pack lives only inside the View record inspector now, not here.
// `downloaded` gates Confirm Receipt (revealed only after a pack download,
// which now happens from inside the inspector).
// `formsComplete` gates View record (as soon as any form has progress).
// Delete is always offered — HR can remove a candidate at any stage.
export function actionsFor(status, downloaded = false, formsComplete = 0) {
  const view = formsComplete > 0 ? ['view'] : [];
  switch (status) {
    case 'invited':
      return ['delete'];
    case 'in_progress':
      return [...view, 'delete'];
    case 'submitted':
      return [...view, ...(downloaded ? ['receipt'] : []), 'delete'];
    case 'received':
      return ['view', 'delete'];
    default:
      return ['delete'];
  }
}

const ACTION_LABEL = {
  receipt: 'Confirm Receipt', view: 'View record',
};

// Delete (and a demo-only Edit placeholder) live behind a "⋮" menu instead of
// a bare button on every row — actionsFor always includes 'delete', so the
// kebab is unconditional; only the primary buttons (view/receipt) vary.
function actionButtonsHTML(invite) {
  const primaryButtons = actionsFor(invite.status, hasPack(invite.id), invite.formsComplete)
    .filter((act) => act !== 'delete')
    .map((act) => `<button class="btn btn-sm btn-secondary" data-act="${act}">${ACTION_LABEL[act]}</button>`)
    .join('');
  const kebab = `<button type="button" class="btn btn-sm btn-secondary kebab-btn" data-act="menu"
    aria-haspopup="true" aria-expanded="false" aria-label="More actions for ${escH(displayName(invite))}">&#8942;</button>`;
  return primaryButtons + kebab;
}

export function rowHTML(invite) {
  const pct = invite.formsTotal ? Math.round((invite.formsComplete / invite.formsTotal) * 100) : 0;
  return `<tr data-id="${escH(invite.id)}">
    <td data-label="Candidate">${escH(displayName(invite))}</td>
    <td data-label="Role">${escH(invite.role)}</td>
    <td data-label="Link sent">${formatDate(invite.linkSentAt)}</td>
    <td data-label="Submitted">${formatDate(invite.submittedAt)}</td>
    <td data-label="Progress">${invite.formsComplete}/${invite.formsTotal}<div class="bar bar-${escH(invite.status)}"><i style="width:${pct}%"></i></div></td>
    <td data-label="Status"><span class="badge badge-${escH(invite.status)}">${escH(statusLabel(invite.status))}</span></td>
    <td data-label="Actions"><div class="row-actions">${actionButtonsHTML(invite)}</div></td>
  </tr>`;
}

// Each card's colour matches its equivalent status badge (badge-in_progress /
// badge-submitted / badge-received in hr.css), so the metrics band reads as
// the same colour language as the Status column below it. Total stays neutral
// since it isn't tied to one status.
function renderMetrics(m) {
  const cards = [
    ['Total Onboarding Candidates', m.total, 'total'],
    ['In Progress', m.inProgress, 'in_progress'],
    ['Submitted – Awaiting Review', m.pendingReview, 'submitted'],
    ['Reviewed & Completed', m.received, 'received'],
  ];
  document.getElementById('metrics').innerHTML = cards
    .map(([label, num, kind]) =>
      `<div class="metric-card metric-${kind}"><div class="num">${num}</div><div class="label">${escH(label)}</div></div>`)
    .join('');
}

function renderMatrix(list) {
  closeMenu(); // a re-render replaces the row DOM — don't leave the menu pointing at a detached button
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

/* ---------- row menu (kebab) ---------- */

function closeMenu() {
  if (!menuOpenId) return;
  document.getElementById('row-menu').hidden = true;
  menuOpenBtn?.setAttribute('aria-expanded', 'false');
  menuOpenId = null;
  menuOpenBtn = null;
}

// Fixed-position so the dropdown is never clipped by the matrix's own
// overflow rules — right-aligned under the kebab, flipped above it when
// there isn't room below (e.g. the last couple of rows in the table).
function positionMenu(btn) {
  const menu = document.getElementById('row-menu');
  const r = btn.getBoundingClientRect();
  menu.hidden = false; // must be visible to measure its height
  const menuH = menu.offsetHeight;
  const opensUp = r.bottom + menuH + 6 > window.innerHeight;
  menu.style.top = `${opensUp ? r.top - menuH - 6 : r.bottom + 6}px`;
  menu.style.left = `${Math.max(8, r.right - menu.offsetWidth)}px`;
}

function openMenu(btn, id) {
  if (menuOpenId === id) { closeMenu(); return; }
  closeMenu();
  menuOpenId = id;
  menuOpenBtn = btn;
  btn.setAttribute('aria-expanded', 'true');
  positionMenu(btn);
}

async function deleteInvite(id, btn) {
  const invite = invites.find((i) => i.id === id);
  if (!invite) return;
  if (!window.confirm(
    `Delete ${invite.name || invite.email}? This permanently removes their invite and `
    + 'onboarding record. This cannot be undone.')) return;
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
    await request(`/invites/${id}`, { method: 'DELETE' });
    showToast('Candidate deleted');
    await refresh();
  } catch (err) {
    if (err.status !== 401) showToast(err.message || 'Action failed');
    render(invites);
  }
}

// Edit is a demo-only placeholder — deliberately does nothing but close the menu.
function onRowMenuClick(e) {
  const btn = e.target.closest('button[data-menu-act]');
  if (!btn) return;
  const id = menuOpenId;
  const act = btn.dataset.menuAct;
  closeMenu();
  if (act === 'delete' && id) deleteInvite(id);
}

async function onMatrixClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;

  if (btn.dataset.act === 'menu') { openMenu(btn, id); return; }

  const invite = invites.find((i) => i.id === id);
  if (!invite) return;
  const act = btn.dataset.act;

  try {
    if (act === 'receipt') {
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
  document.getElementById('row-menu').addEventListener('click', onRowMenuClick);
  // Close the row menu on an outside click, Escape, or the page moving under it.
  document.addEventListener('click', (e) => {
    if (!menuOpenId) return;
    if (e.target.closest('#row-menu') || e.target.closest('[data-act="menu"]')) return;
    closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('scroll', closeMenu, true);
  window.addEventListener('resize', closeMenu);
  // The pack download now happens inside the inspector; re-render the table on
  // close so a freshly-revealed Confirm Receipt button shows without waiting
  // for the next poll.
  window.addEventListener('inspector-closed', () => render(invites));
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
