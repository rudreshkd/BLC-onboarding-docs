// entries.js — repeating entry blocks: employment, gaps, education, CPD, referees, contacts
// Blocks are identified by data-kind; inner inputs carry data-field (no duplicate ids).

function input(field, label, opts = {}) {
  const type = opts.type || 'text';
  const validate = opts.validate ? ` data-validate="${opts.validate}"` : '';
  const req = opts.req ? '<span class="req-mark" aria-hidden="true"> *</span>' : '';
  const reqAttr = opts.req ? ' class="req"' : '';
  const placeholder = opts.placeholder ? ` placeholder="${opts.placeholder}"` : '';
  return `<div class="field">
    <label>${label}${req}</label>
    <input type="${type}" data-field="${field}"${validate}${reqAttr}${placeholder}>
  </div>`;
}

function textarea(field, label, opts = {}) {
  const req = opts.req ? '<span class="req-mark" aria-hidden="true"> *</span>' : '';
  const reqAttr = opts.req ? ' class="req"' : '';
  return `<div class="field">
    <label>${label}${req}</label>
    <textarea data-field="${field}"${reqAttr}></textarea>
  </div>`;
}

export function empEntryBlock(n, opts = {}) {
  // Employment entry: employer name/address, contact, dates, role, reason for leaving
  const months = opts.monthFormat
    ? input('from', 'From (MM/YYYY)', { validate: 'month', req: true, placeholder: '03/2021' }) +
      input('to', 'To (MM/YYYY)', { validate: 'month', placeholder: '11/2023' })
    : input('from', 'From', { type: 'month', req: true }) +
      input('to', 'To', { type: 'month' });
  return `<div class="emp-block" data-kind="employment">
    <p class="entry-title">Employment entry ${n}</p>
    <button type="button" class="remove-entry" aria-label="Remove employment entry ${n}">&minus; Remove</button>
    ${input('employer', 'Employer name & address', { req: true })}
    ${input('contact', 'Contact details (phone or email)')}
    <div class="grid-2">${months}</div>
    ${input('role', 'Job title / role', { req: true })}
    ${input('reason', 'Reason for leaving')}
  </div>`;
}

export function gapEntryBlock(n) {
  return `<div class="emp-block" data-kind="gap">
    <p class="entry-title">Gap in employment ${n}</p>
    <button type="button" class="remove-entry" aria-label="Remove gap entry ${n}">&minus; Remove</button>
    <div class="grid-2">
      ${input('from', 'From (MM/YYYY)', { validate: 'month', req: true, placeholder: '01/2020' })}
      ${input('to', 'To (MM/YYYY)', { validate: 'month', placeholder: '06/2020' })}
    </div>
    ${textarea('reason', 'Reason for gap', { req: true })}
  </div>`;
}

export function eduEntryBlock(n) {
  return `<div class="emp-block" data-kind="education">
    <p class="entry-title">Education entry ${n}</p>
    <button type="button" class="remove-entry" aria-label="Remove education entry ${n}">&minus; Remove</button>
    ${input('institution', 'School / college / university')}
    ${input('qualification', 'Qualification & grade')}
    <div class="grid-2">
      ${input('from', 'From', { type: 'month' })}
      ${input('to', 'To', { type: 'month' })}
    </div>
  </div>`;
}

export function cpdEntryBlock(n) {
  return `<div class="emp-block" data-kind="cpd">
    <p class="entry-title">Training / CPD entry ${n}</p>
    <button type="button" class="remove-entry" aria-label="Remove training entry ${n}">&minus; Remove</button>
    ${input('course', 'Course / training title')}
    ${input('provider', 'Provider')}
    ${input('year', 'Year completed')}
  </div>`;
}

export function refereeBlock(n) {
  return `<div class="emp-block" data-kind="referee">
    <p class="entry-title">Referee ${n}</p>
    ${input('name', 'Full name', { req: true })}
    ${input('organisation', 'Organisation', { req: true })}
    ${input('address', 'Address')}
    ${input('occupation', 'Occupation / job title')}
    <div class="grid-2">
      ${input('phone', 'Phone', { type: 'tel' })}
      ${input('email', 'Email', { type: 'email' })}
    </div>
  </div>`;
}

export function contactBlock(n, required) {
  return `<div class="emp-block" data-kind="contact">
    <p class="entry-title">Emergency contact ${n}${required ? '' : ' (optional)'}</p>
    ${input('name', 'Full name', { req: required })}
    ${input('relationship', 'Relationship to you', { req: required })}
    <div class="grid-2">
      ${input('phone', 'Phone', { type: 'tel', req: required })}
      ${input('altPhone', 'Alternative phone', { type: 'tel' })}
    </div>
    ${input('address', 'Address')}
  </div>`;
}

export function doseBlock(n) {
  return `<div class="emp-block" data-kind="dose">
    <p class="entry-title">Dose ${n}</p>
    <button type="button" class="remove-entry" aria-label="Remove dose ${n}">&minus; Remove</button>
    <div class="grid-2">
      ${input('date', 'Date given', { type: 'date' })}
      ${input('vaccine', 'Vaccine type')}
    </div>
  </div>`;
}

const BUILDERS = {
  employment: empEntryBlock,
  'employment-month': (n) => empEntryBlock(n, { monthFormat: true }),
  gap: gapEntryBlock,
  education: eduEntryBlock,
  cpd: cpdEntryBlock,
  dose: doseBlock,
};

// Append a new entry to the repeater identified by data-repeater.
export function addEntry(repeaterEl) {
  const kind = repeaterEl.dataset.repeater;
  const max = parseInt(repeaterEl.dataset.max || '99', 10);
  const count = repeaterEl.querySelectorAll('.emp-block').length;
  if (count >= max) return;
  const builder = BUILDERS[kind];
  if (!builder) return;
  repeaterEl.insertAdjacentHTML('beforeend', builder(count + 1));
}

export function removeEntry(blockEl) {
  const repeater = blockEl.closest('[data-repeater]');
  blockEl.remove();
  // Renumber remaining entry titles
  if (repeater) {
    repeater.querySelectorAll('.emp-block .entry-title').forEach((title, i) => {
      title.textContent = title.textContent.replace(/\d+$/, String(i + 1));
    });
  }
}
