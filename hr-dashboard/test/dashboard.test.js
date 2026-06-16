import './helpers/dom.js';
import { mockFetch, resetBody, clearSession, DASHBOARD_HTML } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, actionsFor, statusLabel, rowHTML, render, refresh } from '../js/dashboard.js';
import { setToken } from '../js/api.js';

beforeEach(() => { clearSession(); resetBody(DASHBOARD_HTML); });

test('computeMetrics counts total / submitted / received', () => {
  const m = computeMetrics([
    { status: 'invited' }, { status: 'submitted' }, { status: 'submitted' }, { status: 'received' },
  ]);
  assert.deepEqual(m, { total: 4, pendingReview: 2, received: 1 });
});

test('actionsFor maps status → buttons (and gates Confirm Receipt on download)', () => {
  assert.deepEqual(actionsFor('invited'), ['resend']);
  assert.deepEqual(actionsFor('in_progress'), ['resend']);
  assert.deepEqual(actionsFor('submitted', false), ['download', 'resend']);
  assert.deepEqual(actionsFor('submitted', true), ['download', 'resend', 'receipt']);
  assert.deepEqual(actionsFor('received'), ['view']);
});

test('statusLabel humanizes in_progress', () => {
  assert.equal(statusLabel('in_progress'), 'In progress');
});

test('rowHTML escapes hostile email/role (no HTML injection)', () => {
  const html = rowHTML({
    id: '1', email: '<img src=x onerror=alert(1)>@e.com', role: '<b>x</b>',
    status: 'invited', formProgress: {}, formsComplete: 0, formsTotal: 15, submittedAt: null,
  });
  assert.ok(!html.includes('<img src=x'), 'raw markup must not appear');
  assert.ok(html.includes('&lt;') || html.includes('&amp;'), 'values escaped');
});

test('rowHTML carries data-label on every cell (mobile card reflow contract)', () => {
  const html = rowHTML({
    id: '1', email: 'a@b.com', role: 'SW', status: 'invited',
    formProgress: {}, formsComplete: 0, formsTotal: 15, submittedAt: null,
  });
  for (const label of ['Candidate', 'Role', 'Submitted', 'Progress', 'Status', 'Actions']) {
    assert.ok(html.includes(`data-label="${label}"`), `missing data-label ${label}`);
  }
});

test('render populates metrics + matrix; empty list shows the empty note', () => {
  render([{ id: '1', email: 'a@b.com', role: 'SW', status: 'invited', formProgress: {}, formsComplete: 0, formsTotal: 15, submittedAt: null }]);
  assert.ok(document.getElementById('matrix-body').innerHTML.includes('a'));
  assert.equal(document.getElementById('metrics').children.length, 3);
  render([]);
  assert.equal(document.getElementById('matrix-empty').hidden, false);
});

test('refresh has a single-in-flight guard (no stacked polls)', async () => {
  setToken('t');
  let resolve;
  let fetchCount = 0;
  global.fetch = () => {
    fetchCount += 1;
    return new Promise((res) => { resolve = () => res({ status: 200, ok: true, headers: { get: () => 'application/json' }, json: async () => [] }); });
  };
  const p1 = refresh();
  const p2 = refresh(); // should bail — a fetch is already in-flight
  resolve();
  await Promise.all([p1, p2]);
  assert.equal(fetchCount, 1, 'second concurrent refresh did not fire a fetch');
});
