// auth.js — magic link flow (simulated until Phase 3), draft restore on login

import { state } from './state.js';
import { showView, goToDashboard } from './nav.js';
import { loadDraft } from './draft.js';
import { showToast } from './toast.js';

export function sendMagicLink() {
  const emailInput = document.getElementById('login-email');
  const email = emailInput.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.closest('.field')?.classList.add('field-error');
    emailInput.addEventListener('input', () =>
      emailInput.closest('.field')?.classList.remove('field-error'), { once: true });
    showToast('Enter a valid email address');
    return;
  }
  state.profile.email = email;
  showView('view-check-email');
}

export function resendLink() {
  showToast(`Magic link re-sent to ${state.profile.email}`);
}

// Phase 3 replaces this with real token verification (POST /auth/verify), then
// history.replaceState() strips the token from the URL so it never lingers in
// browser history (eng-review T1).
export async function completeLogin() {
  state.loggedIn = true;

  const draft = await loadDraft();
  if (draft) {
    Object.assign(state, draft);
    state.loggedIn = true; // draft must never log us back out
    showToast('Welcome back — your saved progress has been restored');
  }

  if (history.replaceState) {
    history.replaceState(null, '', window.location.pathname);
  }

  goToDashboard();
}

export function wireAuth() {
  document.getElementById('btn-send-link').addEventListener('click', sendMagicLink);
  document.getElementById('btn-resend-link').addEventListener('click', resendLink);
  document.getElementById('btn-open-link').addEventListener('click', completeLogin);
}
