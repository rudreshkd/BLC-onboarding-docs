// main.js — entry: wires static controls, manages view switching + session.

import { login, signOut, isLoggedIn } from './auth.js';
import { setUnauthorizedHandler } from './api.js';
import { showToast } from './toast.js';
import { startDashboard, stopDashboard } from './dashboard.js';
import { openInviteModal } from './invite.js';

const loginView = document.getElementById('view-login');
const dashboardView = document.getElementById('view-dashboard');

function showLogin() {
  stopDashboard();
  dashboardView.hidden = true;
  loginView.hidden = false;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  startDashboard();
}

// api.js calls this on any 401 — bounce HR back to login instead of dead buttons.
setUnauthorizedHandler(() => {
  showToast('Your session expired — please sign in again');
  showLogin();
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.hidden = true;
  try {
    await login(email, password);
    showDashboard();
  } catch (err) {
    errEl.textContent = err.status === 401 ? 'Incorrect email or password' : (err.message || 'Sign-in failed');
    errEl.hidden = false;
  }
});

document.getElementById('btn-signout').addEventListener('click', () => {
  signOut();
  showLogin();
});

document.getElementById('btn-invite').addEventListener('click', () => openInviteModal());

// Boot: resume an existing session or show login.
if (isLoggedIn()) showDashboard();
else showLogin();
