// invite.js — new candidate invite modal (TASK 4.4).
//
// Opens a modal, validates the email client-side, POSTs /invites, then asks the
// dashboard to re-fetch so the new row appears on top.

import { request } from './api.js';
import { showToast } from './toast.js';
import { refresh } from './dashboard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OTHER_ROLE = 'Other';

const ROLE_OPTIONS = [
  'Support Worker',
  'Team Leader',
  'Registered Manager',
  'Service Manager',
  'Area Manager',
  OTHER_ROLE,
];

const FIELDS = [
  { id: 'firstName',  label: 'First name',      type: 'text',  value: '',                    required: true },
  { id: 'middleName', label: 'Middle name',     type: 'text',  value: '' },
  { id: 'surname',    label: 'Surname',         type: 'text',  value: '',                    required: true },
  { id: 'email',   label: 'Candidate email', type: 'email', value: '',                    required: true },
  { id: 'phone',   label: 'Phone number',   type: 'tel',   value: '' },
  { id: 'role',    label: 'Role / job title', type: 'select', value: 'Support Worker', options: ROLE_OPTIONS, required: true },
  // Only shown when Role is set to "Other" — free text for rarer roles (e.g. PBS, Quality).
  { id: 'otherRole', label: 'Specify role', type: 'text', value: '', hidden: true },
  { id: 'startDate', label: 'Interview date', type: 'date', value: '', required: true },
  { id: 'salary',  label: 'Hourly rate',    type: 'text', value: '£12.50 per hour' },
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
    <label class="field" id="inv-field-${f.id}"${f.hidden ? ' hidden' : ''}>
      <span>${f.label}${f.required ? ' *' : ''}</span>
      ${fieldHTML(f)}
    </label>`).join('');
  return `<div class="modal-card">
    <h2 class="brand">Set Up New Candidate</h2>
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

// Success state: show the candidate's magic link with a copy button so HR can
// paste it into an email. The link is also clickable to test the flow directly.
function renderLinkReady(name, link) {
  const m = document.getElementById('invite-modal');
  m.innerHTML = `<div class="modal-card">
    <h2 class="brand">Invite created</h2>
    <p class="muted">Send ${escAttr(name)} their personal onboarding link. They click it to go straight to their forms — no sign-in needed.</p>
    <label class="field">
      <span>Candidate login link</span>
      <input id="inv-link" readonly />
    </label>
    <p class="muted" style="font-size:13px">
      <a id="inv-link-open" href="#" target="_blank" rel="noopener">Open link to test</a>
    </p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-secondary" data-act="done">Done</button>
      <button class="btn btn-primary" data-act="copy">Copy link</button>
    </div>
  </div>`;
  const input = document.getElementById('inv-link');
  input.value = link;
  document.getElementById('inv-link-open').href = link;
}

function escAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function copyLink() {
  const input = document.getElementById('inv-link');
  try {
    await navigator.clipboard.writeText(input.value);
    showToast('Link copied — paste it into the candidate email');
  } catch {
    // Clipboard API blocked (e.g. insecure context) — fall back to selecting.
    input.focus();
    input.select();
    showToast('Press Cmd/Ctrl+C to copy the link');
  }
}

// Read field values; validate. Returns the POST body, or null (and shows error).
export function collectInvite() {
  const val = (id) => document.getElementById(`inv-${id}`).value.trim();
  const firstName = val('firstName');
  const middleName = val('middleName');
  const surname = val('surname');
  const name = [firstName, middleName, surname].filter(Boolean).join(' ');
  const email = val('email');
  const roleChoice = val('role');
  const role = roleChoice === OTHER_ROLE ? val('otherRole') : roleChoice;
  const errEl = document.getElementById('inv-error');
  if (!firstName || !surname) {
    errEl.textContent = 'First name and surname are required';
    errEl.hidden = false;
    return null;
  }
  if (!EMAIL_RE.test(email)) {
    errEl.textContent = 'Enter a valid candidate email address';
    errEl.hidden = false;
    return null;
  }
  if (!role) {
    errEl.textContent = roleChoice === OTHER_ROLE ? 'Enter the candidate\'s role' : 'Role is required';
    errEl.hidden = false;
    return null;
  }
  return {
    name, email, role,
    offerTerms: {
      startDate: val('startDate'), salary: val('salary'),
      hours: val('hours'), manager: val('manager'), phone: val('phone'),
    },
  };
}

async function submit() {
  const body = collectInvite();
  if (!body) return;
  try {
    const { link } = await request('/invites', { method: 'POST', body });
    await refresh(); // new row shows up with its "Link sent" timestamp
    renderLinkReady(body.name, link);
  } catch (err) {
    if (err.status !== 401) {
      const errEl = document.getElementById('inv-error');
      errEl.textContent = err.message || 'Could not send invite';
      errEl.hidden = false;
    }
  }
}

function toggleOtherRole() {
  const isOther = document.getElementById('inv-role').value === OTHER_ROLE;
  document.getElementById('inv-field-otherRole').hidden = !isOther;
  if (!isOther) document.getElementById('inv-otherRole').value = '';
}

export function openInviteModal() {
  const m = document.getElementById('invite-modal');
  m.innerHTML = modalHTML();
  m.hidden = false;
  document.getElementById('inv-role').onchange = toggleOtherRole;
  m.onclick = (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'cancel' || act === 'done' || e.target === m) close();
    if (act === 'submit') submit();
    if (act === 'copy') copyLink();
  };
}
