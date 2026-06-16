import './helpers/dom.js';
import { clearSession } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { recordHTML } from '../js/inspector.js';
import { _clearCache } from '../js/download.js';
import { FORMS } from '../js/forms.js';
import { escH } from '../js/util.js';

beforeEach(() => { clearSession(); _clearCache(); });

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

test('individual Download buttons are disabled until the pack is downloaded', () => {
  const html = recordHTML(invite); // pack not cached
  assert.ok(html.includes('disabled'), 'download buttons disabled pre-download');
});

test('candidate name + role are escaped', () => {
  const html = recordHTML({ ...invite, role: '<b>x</b>' });
  assert.ok(!html.includes('<b>x</b>'));
});
