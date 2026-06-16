import './helpers/dom.js';
import { mockFetch, resetBody, clearSession, DASHBOARD_HTML } from './helpers/dom.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openInviteModal, collectInvite } from '../js/invite.js';

beforeEach(() => { clearSession(); resetBody(DASHBOARD_HTML); });

test('openInviteModal renders the field set with defaults', () => {
  openInviteModal();
  assert.equal(document.getElementById('invite-modal').hidden, false);
  assert.equal(document.getElementById('inv-role').value, 'Support Worker');
  assert.equal(document.getElementById('inv-salary').value, '£12.71/hr');
});

test('collectInvite rejects a malformed email and shows an inline error', () => {
  openInviteModal();
  document.getElementById('inv-email').value = 'not-an-email';
  const body = collectInvite();
  assert.equal(body, null);
  assert.equal(document.getElementById('inv-error').hidden, false);
});

test('collectInvite returns the POST body for a valid invite', () => {
  openInviteModal();
  document.getElementById('inv-email').value = 'candidate@example.com';
  const body = collectInvite();
  assert.equal(body.email, 'candidate@example.com');
  assert.equal(body.role, 'Support Worker');
  assert.equal(body.offerTerms.salary, '£12.71/hr');
});
