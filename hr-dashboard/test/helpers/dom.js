// test/helpers/dom.js — jsdom globals + fetch mock.
//
// Imported FIRST by every test so window/document/sessionStorage exist before
// any js/ module evaluates (api.js reads window.BL_API_BASE at module load).

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost:8080' });

global.window = dom.window;
global.document = dom.window.document;
global.sessionStorage = dom.window.sessionStorage;
global.HTMLElement = dom.window.HTMLElement;
global.Blob = dom.window.Blob || global.Blob;
// jsdom doesn't implement object URLs — stub so saveBlob() doesn't throw.
global.URL.createObjectURL = () => 'blob:test';
global.URL.revokeObjectURL = () => {};
window.BL_API_BASE = 'http://localhost:3000';

// Markup the dashboard/inspector/invite modules expect to find.
export const DASHBOARD_HTML = `
  <div id="metrics"></div>
  <table><tbody id="matrix-body"></tbody></table>
  <p id="matrix-empty" hidden></p>
  <aside id="inspector" hidden></aside>
  <div id="inspector-scrim" hidden></div>
  <div id="invite-modal" hidden></div>`;

export function resetBody(html = '') {
  document.body.innerHTML = html;
}

// Install a mock fetch. `responder(url, opts)` returns a partial Response.
export function mockFetch(responder) {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    const r = (await responder(url, opts)) || {};
    return {
      status: r.status ?? 200,
      ok: r.ok ?? ((r.status ?? 200) < 400),
      headers: { get: (h) => (r.headers || {})[h.toLowerCase()] },
      json: async () => r.json,
      text: async () => r.text ?? '',
      arrayBuffer: async () => r.arrayBuffer ?? new ArrayBuffer(8),
    };
  };
  return calls;
}

export function clearSession() {
  sessionStorage.clear();
}
