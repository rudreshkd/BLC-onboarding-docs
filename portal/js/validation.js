// validation.js — required-field and format checks, inline error display (TASK 1.3)

const NI_RE       = /^[A-Z]{2}\d{6}[A-Z]$/i;
const SORT_RE     = /^(\d{2}-\d{2}-\d{2}|\d{6})$/;
const ACCOUNT_RE  = /^\d{8}$/;
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const MONTH_RE    = /^(0[1-9]|1[0-2])\/\d{4}$/;
// UK phone: optional +44 or leading 0, then 9–10 digits once separators are stripped.
const PHONE_RE    = /^(?:\+44|0)\d{9,10}$/;

export function setError(input, message) {
  const wrapper = input.closest('.field') || input.parentElement;
  if (!wrapper) return;
  wrapper.classList.add('field-error');
  if (!wrapper.querySelector('.error-msg')) {
    const p = document.createElement('p');
    p.className = 'error-msg';
    p.textContent = message;
    wrapper.appendChild(p);
  }
  // Clear the error as soon as the candidate edits the field
  const clear = () => {
    wrapper.classList.remove('field-error');
    wrapper.querySelector('.error-msg')?.remove();
    input.removeEventListener('input', clear);
    input.removeEventListener('change', clear);
  };
  input.addEventListener('input', clear);
  input.addEventListener('change', clear);
}

// Format-only check: returns an error message string, or null if the value is
// empty or correctly formatted. Required-ness is handled separately so that
// live on-blur checks can flag a bad format without nagging about empty fields.
export function formatError(input) {
  const value = (input.value || '').trim();
  if (!value) return null;

  if (input.id === 'ni' || input.dataset.validate === 'ni') {
    if (!NI_RE.test(value.replace(/\s+/g, '')))
      return 'Enter a valid NI number — two letters, six digits, one letter';
  }
  if (input.id === 'sortCode' || input.dataset.validate === 'sortcode') {
    if (!SORT_RE.test(value)) return 'Enter a sort code as 00-00-00 or 6 digits';
  }
  if (input.id === 'accountNumber' || input.dataset.validate === 'account') {
    if (!ACCOUNT_RE.test(value)) return 'Account number must be exactly 8 digits';
  }
  if (input.type === 'email' || input.dataset.validate === 'email') {
    if (!EMAIL_RE.test(value)) return 'Enter a valid email address, e.g. name@example.com';
  }
  if (input.type === 'tel' || input.dataset.validate === 'phone') {
    // Strip spaces, hyphens and brackets before matching so 07700 900 123,
    // (01632) 960123 and +44 7700 900123 all pass.
    if (!PHONE_RE.test(value.replace(/[\s()-]/g, '')))
      return 'Enter a valid UK phone number, e.g. 07700 900123';
  }
  if (input.id === 'postcode' || input.dataset.validate === 'postcode') {
    if (!POSTCODE_RE.test(value)) return 'Enter a valid UK postcode, e.g. SW1A 1AA';
  }
  if (input.dataset.validate === 'month') {
    if (!MONTH_RE.test(value)) return 'Use MM/YYYY format, e.g. 03/2021';
  }
  return null;
}

function checkInput(input) {
  const value = (input.value || '').trim();
  const isRequired = input.closest('.field')?.querySelector('label .req-mark') ||
                     input.required || input.classList.contains('req');

  if (isRequired && !value) {
    if (input.type === 'date') { setError(input, 'Enter a date'); return false; }
    setError(input, 'This field is required');
    return false;
  }

  const msg = formatError(input);
  if (msg) { setError(input, msg); return false; }
  return true;
}

// Live format feedback: as the candidate leaves each field, flag a bad format
// immediately (phone, email, postcode, NI, etc.) instead of waiting for submit.
// Empty fields are left alone here — required checks still fire on submit.
export function wireLiveValidation(root) {
  if (!root) return;
  root.addEventListener('focusout', (e) => {
    const input = e.target;
    if (!input.matches || !input.matches('input')) return;
    if (input.type === 'radio' || input.type === 'checkbox') return;
    if (input.disabled) return;
    const msg = formatError(input);
    if (msg) setError(input, msg);
  });
}

// Validates the currently rendered form. Returns true if clean.
// Highlights failures and scrolls to the first error otherwise.
export function validateForm(id) {
  const root = document.getElementById('form-body');
  if (!root) return true;

  let firstError = null;
  root.querySelectorAll('input, select, textarea').forEach(input => {
    if (input.type === 'radio' || input.type === 'checkbox') return;
    if (input.disabled || input.offsetParent === null) return; // skip hidden conditional fields
    if (!checkInput(input) && !firstError) {
      firstError = input;
    }
  });

  // Required radio groups: at least one option checked
  const seenGroups = new Set();
  root.querySelectorAll('input[type="radio"][data-req="true"]').forEach(radio => {
    if (seenGroups.has(radio.name)) return;
    seenGroups.add(radio.name);
    if (radio.offsetParent === null) return;
    const group = root.querySelectorAll(`input[type="radio"][name="${radio.name}"]`);
    if (![...group].some(r => r.checked)) {
      const choice = radio.closest('.choice');
      if (choice && !choice.querySelector('.error-msg')) {
        choice.classList.add('field-error');
        const p = document.createElement('p');
        p.className = 'error-msg';
        p.textContent = 'Choose an option';
        choice.appendChild(p);
        group.forEach(r => r.addEventListener('change', () => {
          choice.classList.remove('field-error');
          choice.querySelector('.error-msg')?.remove();
        }, { once: true }));
      }
      if (!firstError) firstError = radio;
    }
  });

  // Required agreement checkboxes
  root.querySelectorAll('input[type="checkbox"][data-req="true"]').forEach(box => {
    if (box.offsetParent === null || box.checked) return;
    const row = box.closest('.checkbox-row');
    if (row && !row.querySelector('.error-msg')) {
      row.classList.add('field-error');
      const p = document.createElement('p');
      p.className = 'error-msg';
      p.textContent = 'You must tick this box to continue';
      row.appendChild(p);
      box.addEventListener('change', () => {
        row.classList.remove('field-error');
        row.querySelector('.error-msg')?.remove();
      }, { once: true });
    }
    if (!firstError) firstError = box;
  });

  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}
