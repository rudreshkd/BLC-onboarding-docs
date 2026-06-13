// nav.js — view switching, sign out

import { state } from './state.js';
import { renderDashboard } from './dashboard.js';

export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
  window.scrollTo(0, 0);
  // Topbar actions only make sense once logged in
  const actions = document.getElementById('topbar-actions');
  if (actions) actions.style.display = state.loggedIn ? 'flex' : 'none';
}

export function goToDashboard() {
  renderDashboard();
  showView('view-dashboard');
}

export function signOut() {
  state.loggedIn = false;
  state.session = null;
  sessionStorage.clear();
  showView('view-login');
}
