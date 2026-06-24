// util.js — small shared helpers.

// HTML-escape untrusted strings before interpolation into markup.
// SYNCED FROM portal/js/state.js escH() — keep in step (D4).
export function escH(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ISO timestamp → "DD Mon YYYY HH:MM" (en-GB), or "—" when absent/invalid.
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Derive a display name from an email local-part: "sarah.okonkwo@x" → "Sarah Okonkwo".
export function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || email || '';
}

// HR-entered name first; falls back to a guess from the email (covers rows
// seeded before the name field existed).
export function displayName(invite) {
  return invite.name || nameFromEmail(invite.email);
}
