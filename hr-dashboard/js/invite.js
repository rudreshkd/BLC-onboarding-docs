// invite.js — new candidate invite modal (TASK 4.4).
//
// Opens a modal, validates the email client-side, POSTs /invites, then asks the
// dashboard to re-fetch so the new row appears on top.

import { request } from './api.js';
import { showToast } from './toast.js';
import { refresh } from './dashboard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS = [
  'Support Worker',
  'Senior Support Worker',
  'Team Leader',
  'Care Coordinator',
  'Registered Nurse',
  'Service Manager',
  'Administrator',
];

const FIELDS = [
  { id: 'name',    label: 'Candidate name',  type: 'text',  value: '',                    required: true },
  { id: 'email',   label: 'Candidate email', type: 'email', value: '',                    required: true },
  { id: 'role',    label: 'Role / job title', type: 'select', value: 'Support Worker', options: ROLE_OPTIONS, required: true },
  { id: 'startDate', label: 'Start date',     type: 'date', value: '' },
  { id: 'salary',  label: 'Annual salary',    type: 'text', value: '£26,000' },
  { id: 'hours',   label: 'Contracted hours', type: 'text', value: '35 hours per week' },
  { id: 'manager', label: 'Line manager',     type: 'text', value: '' },
];

function fieldHTML(f) {
  if (f.type === 'select') {
    const opts = f.options.map((o) =>
      `<option value="${o}"${o === f.value ? ' selected' : ''}>${o}</option>`).join('');
    return `<select id="inv-${f.id}">${opts}</select>`;
  }
  return `<input id="inv-${f.id}" type="${f.type}" value="${f.value}" />`;
}

function modalHTML() {
  const rows = FIELDS.map((f) => `
    <label class="field">
      <span>${f.label}${f.required ? ' *' : ''}</span>
      ${fieldHTML(f)}
    </label>`).join('');
  return `<div class="modal-card">
    <h2 class="brand">Invite a candidate</h2>
    ${rows}
    <p id="inv-error" class="error-msg" role="alert" hidden></p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-secondary" data-act="cancel">Cancel</button>
      <button class="btn btn-primary" data-act="submit">Send invite</button>
    </div>
  </div>`;
}

function close() {
  const m = document.getElementById('invite-modal');
  m.hidden = true;
  m.innerHTML = '';
}

// Read field values; validate. Returns the POST body, or null (and shows error).
export function collectInvite() {
  const val = (id) => document.getElementById(`inv-${id}`).value.trim();
  const name = val('name');
  const email = val('email');
  const role = val('role');
  const errEl = document.getElementById('inv-error');
  if (!name) {
    errEl.textContent = 'Candidate name is required';
    errEl.hidden = false;
    return null;
  }
  if (!EMAIL_RE.test(email)) {
    errEl.textContent = 'Enter a valid candidate email address';
    errEl.hidden = false;
    return null;
  }
  if (!role) {
    errEl.textContent = 'Role is required';
    errEl.hidden = false;
    return null;
  }
  return {
    name, email, role,
    offerTerms: {
      startDate: val('startDate'), salary: val('salary'),
      hours: val('hours'), manager: val('manager'),
    },
  };
}

async function submit() {
  const body = collectInvite();
  if (!body) return;
  try {
    await request('/invites', { method: 'POST', body });
    showToast(`Invite sent to ${body.email}`);
    close();
    await refresh();
  } catch (err) {
    if (err.status !== 401) {
      const errEl = document.getElementById('inv-error');
      errEl.textContent = err.message || 'Could not send invite';
      errEl.hidden = false;
    }
  }
}

export function openInviteModal() {
  const m = document.getElementById('invite-modal');
  m.innerHTML = modalHTML();
  m.hidden = false;
  m.onclick = (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'cancel' || e.target === m) close();
    if (act === 'submit') submit();
  };
}
