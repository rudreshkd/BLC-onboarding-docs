// api.js — the single fetch wrapper for all backend calls.
//
//   • Targets the backend origin (window.BL_API_BASE, default localhost:3000).
//   • Attaches Authorization: Bearer <hrToken> from sessionStorage.
//   • THE auth boundary: any 401 clears the token and fires the unauthorized
//     handler (main.js wires this to "show login"), so an expired 8h session
//     bounces HR to login instead of leaving dead buttons.

const API_BASE = (typeof window !== 'undefined' && window.BL_API_BASE) || 'http://localhost:3000';
const TOKEN_KEY = 'hrToken';

let unauthorizedHandler = () => {};
export function setUnauthorizedHandler(fn) { unauthorizedHandler = fn; }

export function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
export function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; }
}

// request('/invites')                       → parsed JSON (or null on 204)
// request('/invites', { method:'POST', body })→ sends JSON
// request('/packs/:id', { raw:true })        → returns the Response (caller reads blob)
export async function request(path, { method = 'GET', body, raw = false, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;

  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: payload });
  } catch {
    throw new ApiError('Network error — is the backend running?', 0);
  }

  if (res.status === 401) {
    clearToken();
    unauthorizedHandler();
    throw new ApiError('Session expired — please sign in again', 401);
  }
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);

  if (raw) return res;
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
