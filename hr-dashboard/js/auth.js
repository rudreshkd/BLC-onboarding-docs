// auth.js — HR login / session.
//
// HR authenticates with email + password (unlike candidates' magic links),
// receiving an 8h role:hr JWT held in sessionStorage (via api.js).

import { request, setToken, clearToken, getToken } from './api.js';

export function isLoggedIn() {
  return !!getToken();
}

// POST /hr/auth/login → { token }. Throws ApiError(401) on bad credentials.
export async function login(email, password) {
  const { token } = await request('/hr/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  setToken(token);
  return token;
}

export function signOut() {
  clearToken();
}
