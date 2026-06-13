// signature.js — signature validation, submitForm, reportProgress (TASK 1.6)

import { state } from './state.js';
import { collectFormData } from './forms.js';
import { validateForm } from './validation.js';
import { goToDashboard } from './nav.js';
import { saveDraft } from './draft.js';
import { showToast } from './toast.js';

// Fire-and-forget progress update to the backend (TASK 1.6).
// Failures are swallowed — this is telemetry, not critical path.
// No-op until real magic-link auth sets state.session (Phase 3).
export async function reportProgress(formId, status) {
  if (!state.session?.inviteId) return;
  try {
    await fetch(`/invites/${state.session.inviteId}/progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.session.token}`,
      },
      body: JSON.stringify({ formId, status }),
    });
  } catch {
    // silent — progress display in HR dashboard will catch up on next poll
  }
}

export function wireSignature(formId) {
  // Clone-and-replace drops listeners left over from a previously opened form.
  const sigInput = refresh('sig-input');
  const doneBtn = refresh('btn-done');
  const saveBtn = refresh('btn-save-close');

  sigInput.value = '';
  doneBtn.disabled = true;
  let validated = false;

  // TASK 1.3: validate the form when the candidate first clicks into the signature input.
  sigInput.addEventListener('focus', () => {
    if (validated) return;
    if (!validateForm(formId)) {
      sigInput.blur();
      showToast('Please fix the highlighted fields before signing');
      return;
    }
    validated = true;
  });

  sigInput.addEventListener('input', () => {
    doneBtn.disabled = sigInput.value.trim().length < 3;
  });

  doneBtn.addEventListener('click', () => {
    if (!validateForm(formId)) {
      showToast('Please fix the highlighted fields before signing');
      return;
    }
    submitForm(formId, sigInput.value.trim());
  });

  saveBtn.addEventListener('click', () => {
    saveDraft(state);
    goToDashboard();
  });
}

function refresh(id) {
  const el = document.getElementById(id);
  const fresh = el.cloneNode(true);
  el.replaceWith(fresh);
  return fresh;
}

export function submitForm(id, signedName) {
  state.submissions[id] = {
    status: 'completed',
    data: collectFormData(id),
    signedName,
    signedAt: new Date().toISOString(),
    // Production also records the candidate's IP server-side (requirements §4.5)
  };
  saveDraft(state);
  reportProgress(id, 'completed');
  showToast('Form submitted');
  goToDashboard();
}
