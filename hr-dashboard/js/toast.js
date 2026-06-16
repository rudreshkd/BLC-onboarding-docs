// toast.js — transient notification.
// SYNCED FROM portal/js/toast.js — keep in step (D4: copied, no shared dir).

let hideTimer = null;

export function showToast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.remove('show'), 3500);
}
