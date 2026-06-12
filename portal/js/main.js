// main.js — entry module: wires static DOM controls once at startup

import { wireAuth } from './auth.js';
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

showView('view-login');
