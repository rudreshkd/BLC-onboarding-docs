import './helpers/dom.js';
import { clearSession, resetBody, mockFetch, DASHBOARD_HTML } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { recordHTML, openRecord } from '../js/inspector.js';
import { _clearCache } from '../js/download.js';
import { FORMS } from '../js/forms.js';
import { escH } from '../js/util.js';

beforeEach(() => { clearSession(); _clearCache(); });

// Minimal JSZip stub matching test/download.test.js's conventions.
function stubJSZip(entries = {}) {
  global.JSZip = {
    loadAsync: async () => ({
      file: (q) => {
        if (typeof q === 'string') return entries[q] || null;
        return Object.keys(entries).filter((k) => q.test(k)).map((k) => entries[k]);
      },
      generateAsync: async () => new ArrayBuffer(16),
    }),
  };
}

function click(panel, selector) {
  const btn = panel.querySelector(selector);
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

const invite = {
  id: 'i1', email: 'sarah.okonkwo@example.com', role: 'Support Worker', status: 'submitted',
  formsComplete: 2, formsTotal: 15, submittedAt: '2026-05-22T14:33:11Z',
  formProgress: { bank: 'completed', application: 'in_progress' },
};

test('record lists all 15 forms across the 5 category groups', () => {
  const html = recordHTML(invite);
  for (const f of FORMS) assert.ok(html.includes(escH(f.name)), `missing form ${f.name}`);
  assert.equal((html.match(/cat-group/g) || []).length, 5);
});

test('per-form status marks reflect formProgress', () => {
  const html = recordHTML(invite);
  assert.ok(html.includes('Completed'), 'bank completed shown');
  assert.ok(html.includes('In progress'), 'application in-progress shown');
  assert.ok(html.includes('Not started'), 'untouched forms show not started');
});

test('candidate name + role are escaped', () => {
  const html = recordHTML({ ...invite, role: '<b>x</b>' });
  assert.ok(!html.includes('<b>x</b>'));
});

test('Review Documents is disabled until every form is complete', () => {
  const html = recordHTML(invite); // 2/15 complete
  const reviewBtn = html.match(/<button[^>]*data-act="review"[^>]*>/)[0];
  assert.ok(reviewBtn.includes('disabled'), 'review disabled while forms incomplete');
});

test('Review Documents is enabled once every form is complete', () => {
  const html = recordHTML({ ...invite, formsComplete: 15, formsTotal: 15 });
  const reviewBtn = html.match(/<button[^>]*data-act="review"[^>]*>/)[0];
  assert.ok(!reviewBtn.includes('disabled'), 'review enabled once all forms complete');
});

test('Complete and Download is disabled until Review Documents has run', () => {
  const html = recordHTML({ ...invite, formsComplete: 15, formsTotal: 15 }); // not reviewed
  const downloadBtn = html.match(/<button[^>]*data-act="complete-download"[^>]*>/)[0];
  assert.ok(downloadBtn.includes('disabled'), 'download disabled pre-review');
});

test('both footer buttons show the purged tooltip when status is received and the pack was never reviewed', () => {
  const html = recordHTML({ ...invite, status: 'received', formsComplete: 15, formsTotal: 15 });
  const reviewBtn = html.match(/<button[^>]*data-act="review"[^>]*>/)[0];
  const downloadBtn = html.match(/<button[^>]*data-act="complete-download"[^>]*>/)[0];
  assert.ok(reviewBtn.includes('disabled') && reviewBtn.includes('Pack purged from relay'), 'review shows purged tooltip');
  assert.ok(downloadBtn.includes('disabled') && downloadBtn.includes('Pack purged from relay'), 'download shows purged tooltip');
});

test('clicking Review Documents fetches the pack, pulls the combined doc, toasts, and re-renders with Complete and Download enabled', async () => {
  resetBody(DASHBOARD_HTML);
  stubJSZip({ 'All_Forms_Combined.html': { async: async () => new Blob(['x']) } });
  mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));

  const complete = { ...invite, formsComplete: 15, formsTotal: 15 };
  openRecord(complete);
  const panel = document.getElementById('inspector');

  click(panel, '[data-act="review"]');
  // onClick's async body needs a tick to resolve before the re-render lands.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const toast = document.getElementById('toast');
  assert.equal(toast.textContent, 'Documents reviewed');
  const downloadBtn = panel.querySelector('[data-act="complete-download"]');
  assert.ok(downloadBtn && !downloadBtn.hasAttribute('disabled'), 'Complete and Download enabled after review');
});

test('onClick swallows a 401 silently but toasts other errors', async () => {
  resetBody(DASHBOARD_HTML);
  // No JSZip stub / no mockFetch token set up — request() throws a plain
  // network-style ApiError (not 401), exercising the catch branch's non-401 path.
  mockFetch(() => ({ status: 500 }));

  const complete = { ...invite, formsComplete: 15, formsTotal: 15 };
  openRecord(complete);
  const panel = document.getElementById('inspector');

  click(panel, '[data-act="review"]');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const toast = document.getElementById('toast');
  assert.equal(toast.textContent, 'Request failed (500)', 'non-401 errors are surfaced via toast');

  // Now exercise the 401 path: the toast must NOT be updated by a 401 failure.
  toast.textContent = '';
  mockFetch(() => ({ status: 401 }));
  click(panel, '[data-act="review"]');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(toast.textContent, '', '401 errors are handled by api.js and not toasted here');
});

test('Review Documents stays disabled when formsTotal is 0 (vacuous 0/0 case)', () => {
  const html = recordHTML({ ...invite, formsComplete: 0, formsTotal: 0 });
  const reviewBtn = html.match(/<button[^>]*data-act="review"[^>]*>/)[0];
  assert.ok(reviewBtn.includes('disabled'), 'review must stay disabled when there are no forms at all');
});

test('review still caches the pack and enables Complete and Download even if pulling the combined doc fails', async () => {
  resetBody(DASHBOARD_HTML);
  stubJSZip({}); // no All_Forms_Combined.html entry -> fileFromPack throws
  mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));

  const complete = { ...invite, formsComplete: 15, formsTotal: 15 };
  openRecord(complete);
  const panel0 = document.getElementById('inspector');

  click(panel0, '[data-act="review"]');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const toast = document.getElementById('toast');
  assert.notEqual(toast.textContent, 'Documents reviewed', 'the success toast is not shown on partial failure');
  // The panel was re-rendered (fresh element) reflecting the now-cached pack,
  // even though the combined-doc fetch failed.
  const panel = document.getElementById('inspector');
  const downloadBtn = panel.querySelector('[data-act="complete-download"]');
  assert.ok(downloadBtn && !downloadBtn.hasAttribute('disabled'), 'Complete and Download reflects the real cached state, not a stale disabled one');
});

test('rapid double-click on Review Documents only fires one fetch, not two', async () => {
  resetBody(DASHBOARD_HTML);
  stubJSZip({ 'All_Forms_Combined.html': { async: async () => new Blob(['x']) } });
  const calls = mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));

  const complete = { ...invite, formsComplete: 15, formsTotal: 15 };
  openRecord(complete);
  const panel = document.getElementById('inspector');

  const btn = panel.querySelector('[data-act="review"]');
  // Two clicks back-to-back, before the first await has a chance to resolve.
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(calls.length, 1, 'second click while the first is in flight must be a no-op');
});

test('clicking Complete and Download (once reviewed) saves the pack, toasts, and re-renders', async () => {
  resetBody(DASHBOARD_HTML);
  stubJSZip({ 'All_Forms_Combined.html': { async: async () => new Blob(['x']) } });
  mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));

  const complete = { ...invite, formsComplete: 15, formsTotal: 15 };
  openRecord(complete);
  const panel1 = document.getElementById('inspector');

  // Review first so Complete and Download is enabled.
  click(panel1, '[data-act="review"]');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const panel2 = document.getElementById('inspector');
  const toast = document.getElementById('toast');
  toast.textContent = '';
  const downloadBtn = panel2.querySelector('[data-act="complete-download"]');
  assert.ok(!downloadBtn.hasAttribute('disabled'), 'sanity: enabled after review');
  click(panel2, '[data-act="complete-download"]');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(toast.textContent, 'Pack downloaded', 'success path toasts on Complete and Download');
  const panel3 = document.getElementById('inspector');
  assert.ok(panel3.querySelector('[data-act="complete-download"]'), 'panel re-rendered after Complete and Download flow');
});

test('a failed review re-enables the button so the user can retry', async () => {
  resetBody(DASHBOARD_HTML);
  mockFetch(() => ({ status: 500 }));

  const complete = { ...invite, formsComplete: 15, formsTotal: 15 };
  openRecord(complete);
  const panel = document.getElementById('inspector');

  click(panel, '[data-act="review"]');
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const btn = panel.querySelector('[data-act="review"]');
  assert.ok(!btn.hasAttribute('disabled'), 'button re-enabled after a failed review so the user can retry');
});

test('a click landing between reviewPack resolving and fileFromPack resolving is a no-op, even across a mid-flight re-render', async () => {
  resetBody(DASHBOARD_HTML);
  let releaseFileFromPack;
  const gate = new Promise((resolve) => { releaseFileFromPack = resolve; });
  stubJSZip({ 'All_Forms_Combined.html': { async: async () => { await gate; return new Blob(['x']); } } });
  const calls = mockFetch(() => ({ status: 200, arrayBuffer: new ArrayBuffer(16) }));

  const complete = { ...invite, formsComplete: 15, formsTotal: 15 };
  openRecord(complete);
  const panel0 = document.getElementById('inspector');

  click(panel0, '[data-act="review"]');
  // Let reviewPack (the fetch) resolve, landing us in the window where the
  // old code re-rendered a fresh, enabled button while fileFromPack was
  // still pending on `gate`.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const panelMidFlight = document.getElementById('inspector');
  const reviewBtnMidFlight = panelMidFlight.querySelector('[data-act="review"]');
  const downloadBtnMidFlight = panelMidFlight.querySelector('[data-act="complete-download"]');
  assert.ok(reviewBtnMidFlight.hasAttribute('disabled'), 'review stays disabled while fileFromPack is still pending');
  assert.ok(downloadBtnMidFlight.hasAttribute('disabled'), 'complete-download also gated while review is still in flight');

  // Second click during the gap must be a no-op: no extra fetch fired.
  click(panelMidFlight, '[data-act="review"]');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.length, 1, 'the mid-flight click did not fire a second reviewPack fetch');

  releaseFileFromPack();
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  const toast = document.getElementById('toast');
  assert.equal(toast.textContent, 'Documents reviewed');
  const panelFinal = document.getElementById('inspector');
  assert.ok(!panelFinal.querySelector('[data-act="complete-download"]').hasAttribute('disabled'), 'settles to enabled once the operation truly completes');
});
