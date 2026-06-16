// main.js — entry module: wires static DOM controls once at startup

import { wireAuth, tryTokenLogin } from './auth.js';
import { wireDashboard, wireProfile } from './dashboard.js';
import { wireDownloads } from './downloads.js';
import { showView, goToDashboard, signOut } from './nav.js';

wireAuth();
wireDashboard();
wireProfile();
wireDownloads();

document.getElementById('btn-signout').addEventListener('click', signOut);
document.getElementById('btn-back-dashboard').addEventListener('click', goToDashboard);
document.querySelectorAll('[data-nav="dashboard"]').forEach(btn =>
  btn.addEventListener('click', goToDashboard));

// If the page was opened from a magic link (?token=), verify it on load and go
// straight to the dashboard; otherwise show the normal login view.
tryTokenLogin().then((handled) => {
  if (!handled) showView('view-login');
});
