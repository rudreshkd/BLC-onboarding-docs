// main.js — entry module: wires static DOM controls once at startup

import { tryTokenLogin } from './auth.js';
import { wireDashboard, wireProfile } from './dashboard.js';
import { wireDownloads } from './downloads.js';
import { showView, goToDashboard, signOut } from './nav.js';

wireDashboard();
wireProfile();
wireDownloads();

document.getElementById('btn-signout').addEventListener('click', signOut);
document.getElementById('btn-back-dashboard').addEventListener('click', goToDashboard);
document.querySelectorAll('[data-nav="dashboard"]').forEach(btn =>
  btn.addEventListener('click', goToDashboard));

// The page is opened from a candidate's invite link (?token=): verify it on load
// and go straight to the forms. With no token we can't identify them, so show the
// "open your invite link" message.
tryTokenLogin().then((handled) => {
  if (!handled) showView('view-login');
});
