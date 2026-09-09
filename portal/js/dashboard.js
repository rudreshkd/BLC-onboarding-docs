// dashboard.js — renderDashboard, badgeHTML, submit-pack gating

import { state, FORMS, escH, statusOf, completedCount, allComplete, formatDate, REQUIRED_FIRST, gateComplete } from './state.js';
import { openForm } from './forms.js';
import { saveDraft, clearDraft } from './draft.js';
import { showView } from './nav.js';
import { showDownloads } from './downloads.js';
import { showToast } from './toast.js';
import { formatError, setError, wireLiveValidation } from './validation.js';
import { submitPackToHR } from './submit.js';

export function badgeHTML(status) {
  // Glyph + text so colour is never the only signal (WCAG)
  const map = {
    notstarted: ['badge-notstarted', '○', 'Not started'],
    inprogress: ['badge-inprogress', '◐', 'In progress'],
    completed:  ['badge-completed', '✓', 'Completed'],
  };
  const [cls, glyph, label] = map[status];
  return `<span class="badge ${cls}"><span aria-hidden="true">${glyph}</span>${label}</span>`;
}

function lockedBadgeHTML() {
  return `<span class="badge badge-locked"><span aria-hidden="true">&#128274;</span>Locked</span>`;
}

function formRowHTML(f, { locked = false } = {}) {
  const status = statusOf(f.id);
  const sub = state.submissions[f.id];
  const submitted = status === 'completed' && sub?.signedAt
    ? `Submitted ${formatDate(sub.signedAt)}` : '';
  const lockedAttrs = locked ? ' aria-disabled="true" data-locked="true"' : '';
  return `<li>
    <button type="button" class="form-row${locked ? ' form-row-locked' : ''}" data-form="${f.id}"${lockedAttrs}>
      <span class="meta">
        <span class="name">${escH(f.name)}</span>
        ${submitted ? `<span class="sub">${submitted}</span>` : ''}
      </span>
      <span class="right">${locked ? lockedBadgeHTML() : badgeHTML(status)}</span>
    </button>
  </li>`;
}

// Names of whatever Step 1 items are still outstanding, for hints and toasts.
function gateOutstanding() {
  const items = [];
  if (!state.profileComplete) items.push('Your Personal Details');
  REQUIRED_FIRST.forEach(id => {
    if (statusOf(id) !== 'completed') items.push(FORMS.find(f => f.id === id).name);
  });
  return items;
}

// Detect the Step 1 → Step 2 unlock moment across re-renders (session-local UI
// state only; deliberately not persisted).
let lastGateState = null;

export function renderDashboard() {
  const done = completedCount();
  const total = FORMS.length;
  const gateOpen = gateComplete();

  document.getElementById('dash-welcome').textContent =
    `Welcome, ${state.profile.firstName || 'there'}!`;
  document.getElementById('dash-deadline').textContent =
    `Your start date: ${formatDate(state.offer.startDate)} — please complete all forms before then.`;

  document.getElementById('dash-progress-fill').style.width = `${(done / total) * 100}%`;
  const label = document.getElementById('dash-progress-label');
  label.textContent = `${done} of ${total} forms complete`;

  // Step 1: personal details profile + the forms BLC wants up front.
  const profileStatus = state.profileComplete ? 'completed' : 'notstarted';
  const step1 = document.getElementById('dash-step1-list');
  step1.innerHTML = `<li>
      <button type="button" class="form-row" data-profile-row>
        <span class="meta">
          <span class="name">Your Personal Details</span>
          <span class="sub">Fill in once — pre-fills every form</span>
        </span>
        <span class="right">${badgeHTML(profileStatus)}</span>
      </button>
    </li>`
    + REQUIRED_FIRST.map(id => formRowHTML(FORMS.find(f => f.id === id))).join('');

  // Step 2: everything else, locked until Step 1 is done. Forms already
  // completed stay openable (read-only) even if the gate is somehow unmet.
  const step2 = document.getElementById('dash-step2-list');
  step2.innerHTML = FORMS
    .filter(f => !REQUIRED_FIRST.includes(f.id))
    .map(f => formRowHTML(f, { locked: !gateOpen && statusOf(f.id) !== 'completed' }))
    .join('');

  document.getElementById('step2-hint').style.display = gateOpen ? 'none' : 'inline';
  document.getElementById('gate-hint').style.display = 'none';

  step1.querySelector('[data-profile-row]').addEventListener('click', openProfile);
  [step1, step2].forEach(list =>
    list.querySelectorAll('[data-form]').forEach(btn =>
      btn.addEventListener('click', () => {
        if (btn.dataset.locked) showGateHint();
        else openForm(btn.dataset.form);
      })));

  // Hero CTA walks the candidate through the required sequence.
  const cta = document.getElementById('btn-edit-profile');
  if (!state.profileComplete) cta.textContent = 'Start';
  else if (!gateOpen) cta.textContent = 'Continue';
  else cta.textContent = 'Edit your details';

  // Celebrate the unlock the first time the gate opens this session.
  if (lastGateState === false && gateOpen && !allComplete()) {
    const left = FORMS.filter(f => statusOf(f.id) !== 'completed').length;
    showToast(`All forms unlocked — ${left} to go`);
  }
  lastGateState = gateOpen;

  const submitBtn = document.getElementById('btn-submit-pack');
  const complete = allComplete();
  submitBtn.disabled = !complete || state.packSubmitted;
  submitBtn.textContent = state.packSubmitted ? 'Pack sent to HR ✓' : 'Submit pack to HR';
  document.getElementById('outstanding-list').style.display = 'none';
}

function openProfile() {
  fillProfileForm(); // repopulate inputs from saved state each time it opens
  showView('view-profile');
}

// Locked-row click: explain the gate instead of dead-ending (mirrors the
// disabled submit button's outstanding-forms pattern).
export function showGateHint() {
  const box = document.getElementById('gate-hint');
  box.innerHTML = `<strong>These forms unlock after Step 1.</strong>
    <ul>${gateOutstanding().map(n => `<li>${escH(n)}</li>`).join('')}</ul>`;
  box.style.display = 'block';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Disabled-button area click: show which forms are outstanding (requirements §4.3)
export function showOutstanding() {
  if (allComplete()) return;
  const missing = FORMS.filter(f => statusOf(f.id) !== 'completed');
  const box = document.getElementById('outstanding-list');
  box.innerHTML = `<strong>Still to complete:</strong>
    <ul>${missing.map(f => `<li>${escH(f.name)}</li>`).join('')}</ul>`;
  box.style.display = 'block';
}

export function confirmSubmitPack() {
  if (!allComplete() || state.packSubmitted) return;
  document.getElementById('modal-submit-pack').classList.add('open');
}

export async function submitPack() {
  document.getElementById('modal-submit-pack').classList.remove('open');
  const btn = document.getElementById('btn-submit-pack');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Encrypting and sending…';

  try {
    // TASK 2.3: buildZip → PUT to relay over HTTPS (server encrypts at rest, Phase 3).
    const result = await submitPackToHR();

    if (result.status === 'offline') {
      // Pack is ready; retry automatically when the connection returns.
      showToast('You appear to be offline. Your pack will be sent when you reconnect.');
      window.addEventListener('online', () => { submitPack(); }, { once: true });
      btn.disabled = false;
      btn.textContent = original;
      return;
    }

    // 'uploaded' (relay accepted it) or 'no-backend' (relay not deployed yet) —
    // either way the candidate's journey is complete. Clear the encrypted draft.
    state.packSubmitted = true;
    await clearDraft();
    showView('view-success');
  } catch {
    // Reachable relay returned an error: keep the draft, let them retry.
    showToast('Upload failed — please try again');
    btn.disabled = false;
    btn.textContent = original;
  }
}

export function wireDashboard() {
  document.getElementById('btn-submit-pack').addEventListener('click', confirmSubmitPack);
  // The disabled submit button has pointer-events:none, so clicks on it land
  // here and reveal the outstanding-forms list (requirements §4.3).
  document.getElementById('submit-pack-area').addEventListener('click', () => {
    if (!allComplete()) showOutstanding();
  });
  document.getElementById('btn-modal-yes').addEventListener('click', submitPack);
  document.getElementById('btn-modal-back').addEventListener('click', () =>
    document.getElementById('modal-submit-pack').classList.remove('open'));
  document.getElementById('link-downloads').addEventListener('click', showDownloads);
  // Hero CTA: drive the required sequence — details, then the Step 1 forms,
  // then it settles into a plain edit-details entry point.
  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    if (state.profileComplete && !gateComplete()) {
      const nextId = REQUIRED_FIRST.find(id => statusOf(id) !== 'completed');
      if (nextId) { openForm(nextId); return; }
    }
    openProfile();
  });
}

/* ---------- profile form ---------- */

const PROFILE_FIELDS = ['title', 'firstName', 'lastName', 'dob', 'sex', 'ni',
  'addr1', 'addr2', 'city', 'county', 'postcode', 'mobile', 'homePhone', 'email'];

export function fillProfileForm() {
  PROFILE_FIELDS.forEach(key => {
    const el = document.getElementById(`profile-${key}`);
    if (el) el.value = state.profile[key] || '';
  });
}

export function saveDetails() {
  const required = ['firstName', 'lastName', 'dob', 'sex', 'ni', 'addr1', 'city', 'postcode', 'mobile', 'email'];
  let valid = true;
  required.forEach(key => {
    const el = document.getElementById(`profile-${key}`);
    if (el && !el.value.trim()) {
      el.closest('.field')?.classList.add('field-error');
      valid = false;
      const clear = () => el.closest('.field')?.classList.remove('field-error');
      el.addEventListener('input', clear, { once: true });
      if (el.tagName === 'SELECT') el.addEventListener('change', clear, { once: true });
    }
  });
  if (!valid) {
    showToast('Please complete the highlighted fields');
    return;
  }

  // Format checks: phone, email, postcode, NI must be well-formed before saving,
  // otherwise the bad value pre-fills every downstream form.
  let formatOk = true;
  PROFILE_FIELDS.forEach(key => {
    const el = document.getElementById(`profile-${key}`);
    if (!el) return;
    const msg = formatError(el);
    if (msg) { setError(el, msg); formatOk = false; }
  });
  if (!formatOk) {
    showToast('Please correct the highlighted fields');
    return;
  }
  PROFILE_FIELDS.forEach(key => {
    const el = document.getElementById(`profile-${key}`);
    if (el) state.profile[key] = el.value.trim();
  });
  state.profileComplete = true;
  saveDraft(state);
  showToast('Details saved — they will pre-fill every form');
  renderDashboard();
  showView('view-dashboard');
}

export function wireProfile() {
  document.getElementById('btn-save-profile').addEventListener('click', saveDetails);
  // Live format feedback as the candidate leaves each profile field.
  wireLiveValidation(document.getElementById('view-profile'));
}
