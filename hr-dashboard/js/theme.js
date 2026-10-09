// theme.js — dark/light mode toggle for the sidebar's last item, persisted in
// localStorage so it survives reloads. Only the structural surface/text/border
// tokens change (tokens.css [data-theme="dark"]) — badges, buttons and other
// brand colours are left as-is.

const KEY = 'hrTheme';

export function getTheme() {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

function reflectToggle(theme) {
  const toggle = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-toggle-icon');
  const label = document.getElementById('theme-toggle-label');
  const dark = theme === 'dark';
  if (toggle) toggle.setAttribute('aria-pressed', String(dark));
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
  if (label) label.textContent = dark ? 'Light mode' : 'Dark mode';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  reflectToggle(theme);
}

export function initTheme() {
  applyTheme(getTheme());
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    applyTheme(next);
  });
}
