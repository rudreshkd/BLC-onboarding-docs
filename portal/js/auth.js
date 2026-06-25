// auth.js — magic-link sign-in: a candidate's invite link (?token=) is the only
// way in. No email entry, no password — the link drops them straight on the forms.

import { state, API_BASE } from './state.js';
import { showView, goToDashboard } from './nav.js';
import { loadDraft } from './draft.js';
import { showToast } from './toast.js';

// Strip any ?token= from the URL so it never lingers in browser history.
function stripTokenFromUrl() {
  if (history.replaceState) {
    history.replaceState(null, '', window.location.pathname);
  }
}

// Restore an encrypted local draft (if any) onto state after login.
async function restoreDraft() {
  const draft = await loadDraft();
  if (draft) {
    Object.assign(state, draft);
    state.loggedIn = true; // draft must never log us back out
    showToast('Welcome back — your saved progress has been restored');
  }
}

// Real magic-link login. Called once on page load: if the URL carries
// ?token=, verify it against the backend, establish state.session, and enter the
// dashboard. Returns true if it handled a token (success OR failure), false if
// no token was present so the caller can show the normal login view.
export async function tryTokenLogin() {
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) return false;

  let res;
  try {
    res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Backend not reachable (relay not deployed) — fall back to the demo flow.
    stripTokenFromUrl();
    showView('view-login');
    return true;
  }

  if (!res.ok) {
    stripTokenFromUrl();
    showToast('That sign-in link has expired or was already used');
    showView('view-login');
    return true;
  }

  const { sessionToken, inviteId, offerTerms } = await res.json();
  state.session = { inviteId, token: sessionToken };
  state.loggedIn = true;
  if (offerTerms) {
    state.offer = { ...state.offer, ...offerTerms };
  }
  if (offerTerms?.email) state.profile.email = offerTerms.email;

  await restoreDraft();
  stripTokenFromUrl();
  goToDashboard();
  return true;
}
