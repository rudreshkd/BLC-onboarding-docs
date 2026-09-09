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

function formRowHTML(f) {
  const status = statusOf(f.id);
  const sub = state.submissions[f.id];
  const submitted = status === 'completed' && sub?.signedAt
    ? `Submitted ${formatDate(sub.signedAt)}` : '';
  return `<li>
    <button type="button" class="form-row" data-form="${f.id}">
      <span class="meta">
        <span class="name">${escH(f.name)}</span>
        ${submitted ? `<span class="sub">${submitted}</span>` : ''}
      </span>
      <span class="right">${badgeHTML(status)}</span>
    </button>
  </li>`;
}

// Which part of the dashboard is showing. Session-local UI state, deliberately
// not persisted: each render derives the default from the gate, and the
// stepper lets the candidate flip back to review Part 1.
let currentPart = null;
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

  // Finishing Part 1 advances the candidate to Part 2 automatically.
  if (lastGateState === false && gateOpen) {
    currentPart = 2;
    if (!allComplete()) showToast('Part 1 complete — your remaining forms are now available');
  }
  lastGateState = gateOpen;
  if (!gateOpen) currentPart = 1;
  else if (currentPart === null) currentPart = 2;

  // Stepper at the top shows which part you're on; Part 1's number becomes a
  // tick once done. Part 2 stays disabled until the gate opens.
  const p1 = document.getElementById('stepper-part1');
  const p2 = document.getElementById('stepper-part2');
  p1.classList.toggle('active', currentPart === 1);
  p1.classList.toggle('done', gateOpen);
  p1.querySelector('.stepper-num').innerHTML = gateOpen ? '&#10003;' : '1';
  p2.classList.toggle('active', currentPart === 2);
  p2.disabled = !gateOpen;
  if (currentPart === 1) { p1.setAttribute('aria-current', 'step'); p2.removeAttribute('aria-current'); }
  else { p2.setAttribute('aria-current', 'step'); p1.removeAttribute('aria-current'); }

  const heading = document.getElementById('part-heading');
  heading.innerHTML = currentPart === 1
    ? `Part 1 — Your details and employment history
       ${gateOpen ? '' : '<span class="step-hint">Complete both to unlock the rest of your forms</span>'}`
    : `Part 2 — Remaining forms`;

  // Part 1: enter-your-details row + the forms BLC wants up front. The row is
  // the single entry point for personal details on this part.
  const profileStatus = state.profileComplete ? 'completed' : 'notstarted';
  const step1 = document.getElementById('dash-step1-list');
  step1.innerHTML = `<li>
      <button type="button" class="form-row" data-profile-row>
        <span class="meta">
          <span class="name">${state.profileComplete ? 'Your details' : 'Enter your details'}</span>
          <span class="sub">Fill in once — pre-fills every form</span>
        </span>
        <span class="right">${badgeHTML(profileStatus)}</span>
      </button>
    </li>`
    + REQUIRED_FIRST.map(id => formRowHTML(FORMS.find(f => f.id === id))).join('');
  step1.querySelector('[data-profile-row]').addEventListener('click', openProfile);

  // Part 2: everything else, only rendered visible once Part 1 is done.
  const step2 = document.getElementById('dash-step2-list');
  step2.innerHTML = FORMS
    .filter(f => !REQUIRED_FIRST.includes(f.id))
    .map(f => formRowHTML(f))
    .join('');

  step1.style.display = currentPart === 1 ? '' : 'none';
  step2.style.display = currentPart === 2 ? '' : 'none';
  // Submitting the pack belongs to Part 2; downloads stay available in both.
  document.getElementById('submit-wrap').style.display = currentPart === 2 ? '' : 'none';

  [step1, step2].forEach(list =>
    list.querySelectorAll('[data-form]').forEach(btn =>
      btn.addEventListener('click', () => openForm(btn.dataset.form))));

  // Hero button only appears on Part 2, as the way back into saved details
  // (on Part 1 the enter-your-details row is the entry point).
  const cta = document.getElementById('btn-edit-profile');
  cta.style.display = currentPart === 2 ? '' : 'none';
  cta.textContent = 'Edit your details';

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
  // Stepper: switch parts. Part 2 is a disabled button until the gate opens,
  // so its handler only ever fires when allowed.
  document.getElementById('stepper-part1').addEventListener('click', () => {
    currentPart = 1; renderDashboard();
  });
  document.getElementById('stepper-part2').addEventListener('click', () => {
    currentPart = 2; renderDashboard();
  });
  document.getElementById('btn-edit-profile').addEventListener('click', openProfile);
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
