// forms.js — form rendering (FORM_BODIES), openForm, collectFormData (TASK 1.2)

import { state, FORMS, escH, fullName, fullAddr, formatDate } from './state.js';
import {
  empEntryBlock, gapEntryBlock, eduEntryBlock, cpdEntryBlock,
  refereeBlock, contactBlock, doseBlock, addEntry, removeEntry,
} from './entries.js';
import { wireSignature, reportProgress } from './signature.js';
import { wireLiveValidation } from './validation.js';
import { showView } from './nav.js';

/* ---------- field builders ---------- */

function fld(id, label, opts = {}) {
  const type = opts.type || 'text';
  const req = opts.req ? '<span class="req-mark" aria-hidden="true"> *</span>' : '';
  const reqAttr = opts.req ? ' class="req"' : '';
  const validate = opts.validate ? ` data-validate="${opts.validate}"` : '';
  const placeholder = opts.placeholder ? ` placeholder="${escH(opts.placeholder)}"` : '';
  const value = opts.value !== undefined ? ` value="${escH(opts.value)}"` : '';
  return `<div class="field">
    <label for="${id}">${label}${req}</label>
    <input type="${type}" id="${id}"${validate}${reqAttr}${placeholder}${value}>
  </div>`;
}

// Pre-filled profile field: visually distinct, read-only (requirements §4.2)
function pre(id, label, value) {
  return `<div class="field prefilled">
    <label for="${id}">${label}</label>
    <input type="text" id="${id}" value="${escH(value)}" readonly tabindex="-1">
  </div>`;
}

function ta(id, label, opts = {}) {
  const req = opts.req ? '<span class="req-mark" aria-hidden="true"> *</span>' : '';
  const reqAttr = opts.req ? ' class="req"' : '';
  return `<div class="field">
    <label for="${id}">${label}${req}</label>
    <textarea id="${id}"${reqAttr}></textarea>
  </div>`;
}

function sel(id, label, options, opts = {}) {
  const req = opts.req ? '<span class="req-mark" aria-hidden="true"> *</span>' : '';
  const reqAttr = opts.req ? ' class="req"' : '';
  const opts_html = ['<option value="">— Select —</option>',
    ...options.map(o => `<option value="${escH(o)}">${escH(o)}</option>`)].join('');
  return `<div class="field">
    <label for="${id}">${label}${req}</label>
    <select id="${id}"${reqAttr}>${opts_html}</select>
  </div>`;
}

// Yes/No radio group. opts.reveal shows #cond-<name> when the answer matches
// opts.revealOn (default 'Yes').
function yn(name, label, opts = {}) {
  const req = opts.req ? ' data-req="true"' : '';
  const reveal = opts.reveal ? ` data-reveal="${opts.reveal}" data-reveal-on="${opts.revealOn || 'Yes'}"` : '';
  return `<div class="choice">
    <span class="choice-label" id="lbl-${name}">${label}${opts.req ? '<span class="req-mark" aria-hidden="true"> *</span>' : ''}</span>
    <div class="options" role="radiogroup" aria-labelledby="lbl-${name}">
      <label><input type="radio" name="${name}" value="Yes"${req}${reveal}> Yes</label>
      <label><input type="radio" name="${name}" value="No"${req}${reveal}> No</label>
    </div>
  </div>`;
}

function cond(id, inner) {
  return `<div class="conditional" id="${id}">${inner}</div>`;
}

function chk(id, label, opts = {}) {
  const req = opts.req ? ' data-req="true"' : '';
  return `<div class="checkbox-row">
    <input type="checkbox" id="${id}"${req}>
    <label for="${id}">${label}</label>
  </div>`;
}

function section(title, body) {
  return `<div class="section"><h2>${title}</h2><div class="section-body">${body}</div></div>`;
}

function repeater(kind, blocks, addLabel, opts = {}) {
  const max = opts.max ? ` data-max="${opts.max}"` : '';
  return `<div data-repeater="${kind}"${max}>${blocks}</div>
    <button type="button" class="add-entry" data-add="${kind}">+ Add ${addLabel}</button>`;
}

/* ---------- shared profile sections ---------- */

function personalDetailsSection(extra = {}) {
  const p = state.profile;
  let body = `<div class="grid-2">
    ${pre('pf-name', 'Full name', fullName())}
    ${pre('pf-dob', 'Date of birth', formatDate(p.dob))}`;
  if (extra.sex) body += pre('pf-sex', 'Sex', p.sex);
  if (extra.ni !== false) body += pre('pf-ni', 'National Insurance number', p.ni);
  body += `${pre('pf-mobile', 'Mobile number', p.mobile)}`;
  if (extra.homePhone) body += pre('pf-home', 'Home phone', p.homePhone);
  body += `${pre('pf-email', 'Email address', p.email)}</div>
    ${pre('pf-addr', 'Address', fullAddr())}`;
  return section('Personal details (from your profile)', body);
}

/* ---------- the 17 health questionnaire conditions ---------- */

const HEALTH_CONDITIONS = [
  ['hc-epilepsy',   'Epilepsy, fits, blackouts or fainting episodes'],
  ['hc-diabetes',   'Diabetes'],
  ['hc-heart',      'Heart disease, chest pain or high blood pressure'],
  ['hc-asthma',     'Asthma, bronchitis or other chest conditions'],
  ['hc-back',       'Back problems or injury'],
  ['hc-joints',     'Joint problems (knees, hips, shoulders)'],
  ['hc-hearing',    'Hearing difficulties'],
  ['hc-eyesight',   'Eyesight problems not corrected by glasses'],
  ['hc-skin',       'Skin conditions (dermatitis, eczema, psoriasis)'],
  ['hc-allergies',  'Allergies (including latex)'],
  ['hc-stomach',    'Stomach, bowel or digestive problems'],
  ['hc-mental',     'Anxiety, depression or other mental health conditions'],
  ['hc-neuro',      'Migraine or other neurological conditions'],
  ['hc-mobility',   'Difficulty with lifting, bending or mobility'],
  ['hc-infectious', 'Any infectious or communicable disease'],
  ['hc-medication', 'Currently taking prescribed medication'],
  ['hc-other',      'Any other medical condition not listed above'],
];

/* ---------- form bodies ---------- */

const FORM_BODIES = {
  application() {
    return personalDetailsSection({ homePhone: true })
      + section('Essential eligibility', [
          yn('eligRightToWork', 'Do you have the right to work in the UK?', { req: true }),
          yn('eligDbs', 'Are you willing to undergo an enhanced DBS check?', { req: true }),
          yn('eligBarred', 'Are you on any barred list or subject to safeguarding restrictions?', { req: true, reveal: 'cond-eligBarred' }),
          cond('cond-eligBarred', ta('eligBarredDetail', 'Please give details', { req: true })),
        ].join(''))
      + section('Further questions', [
          yn('priorConnection', 'Have you previously worked for, or do you know anyone who works for, Brighter Living Care?', { reveal: 'cond-priorConnection' }),
          cond('cond-priorConnection', ta('priorConnectionDetail', 'Please give details')),
          yn('otherCommitments', 'Do you have any other work or commitments that could affect your availability?', { reveal: 'cond-otherCommitments' }),
          cond('cond-otherCommitments', ta('otherCommitmentsDetail', 'Please give details')),
        ].join(''))
      + section('Education history',
          repeater('education', eduEntryBlock(1) + eduEntryBlock(2) + eduEntryBlock(3), 'education entry'))
      + section('Training & CPD',
          repeater('cpd', cpdEntryBlock(1) + cpdEntryBlock(2) + cpdEntryBlock(3), 'training entry'))
      + section('Current employment', [
          yn('currentlyEmployed', 'Are you currently employed?', { reveal: 'cond-currentlyEmployed' }),
          cond('cond-currentlyEmployed', fld('noticePeriod', 'What is your notice period?')),
        ].join(''))
      + section('Employment history (most recent first)',
          repeater('employment', empEntryBlock(1) + empEntryBlock(2), 'employment entry'))
      + section('Gaps in employment',
          ta('gapsExplanation', 'Please explain any gaps in your employment history'))
      + section('References — please provide three referees',
          refereeBlock(1) + refereeBlock(2) + refereeBlock(3))
      + section('Additional questions', [
          ta('skillsStatement', 'Tell us about the skills and experience that make you suitable for this role', { req: true }),
          yn('sleepInShifts', 'Are you willing to work sleep-in shifts?', { req: true }),
          yn('drivingLicence', 'Do you hold a full UK driving licence?', { req: true }),
          yn('covidVaccinated', 'Have you been vaccinated against COVID-19?'),
        ].join(''))
      + section('Talent pool (GDPR)', `
          <div class="declaration"><p>If your application is unsuccessful, we would like to keep
          your details on file for up to 6 months and contact you about similar roles.</p></div>
          ${chk('talentPoolConsent', 'I consent to Brighter Living Care Ltd keeping my details on file for future vacancies')}`);
  },

  staffDetails() {
    return personalDetailsSection({ homePhone: true })
      + section('Emergency contacts', contactBlock(1, true) + contactBlock(2, false))
      + section('Medical information (strictly confidential)', `
          <div class="info-box">This information is held confidentially and used only to keep you safe at work.</div>
          ${ta('medicalConditions', 'Please list any medical conditions or regular medication we should be aware of')}`)
      + section('Any other comments', ta('otherComments', 'Anything else you would like to tell us'));
  },

  staffProfile() {
    const p = state.profile;
    return section('Your details (from your profile)', `<div class="grid-2">
        ${pre('pf-name', 'Full name', fullName())}
        ${pre('pf-dob', 'Date of birth', formatDate(p.dob))}
        ${pre('pf-mobile', 'Telephone', p.mobile)}
      </div>`)
      + section('Role details', `<div class="grid-2">
          ${pre('pf-role', 'Role', state.offer.role)}
          ${pre('pf-start', 'Start date', formatDate(state.offer.startDate))}
          ${fld('leavingDate', 'Leaving date (leave blank for new starters)', { type: 'date' })}
        </div>`)
      + section('About you', ta('interests', 'Personal interests — tell residents and colleagues a little about yourself'));
  },

  bank() {
    const p = state.profile;
    return section('Your details (from your profile)', `<div class="grid-2">
        ${pre('pf-name', 'Full name', fullName())}
        ${pre('pf-dob', 'Date of birth', formatDate(p.dob))}
        ${pre('pf-ni', 'National Insurance number', p.ni)}
      </div>
      ${pre('pf-addr', 'Address', fullAddr())}`)
      + section('Bank account details', `
          ${fld('bankName', 'Bank or building society name', { req: true })}
          <div class="grid-2">
            ${fld('accountNumber', 'Account number', { req: true, validate: 'account', placeholder: '12345678' })}
            ${fld('sortCode', 'Sort code', { req: true, validate: 'sortcode', placeholder: '00-00-00' })}
          </div>`)
      + section('Comments (optional)', ta('bankComments', 'Any comments, e.g. building society roll number'));
  },

  hmrc() {
    return personalDetailsSection()
      + section('Employee statement', [
          '<div class="info-box">Answer the three questions below — your starter statement (A, B or C) is selected automatically, exactly as on the official HMRC checklist.</div>',
          yn('hmrcFirstJob', 'Is this your first job since 6 April this tax year?', { req: true }),
          yn('hmrcOtherPayments', 'Since 6 April, have you received payments from another job, Jobseeker’s Allowance, Employment and Support Allowance or Incapacity Benefit?', { req: true }),
          yn('hmrcAnotherJob', 'Do you have another job or receive a pension?', { req: true }),
          `<div class="declaration" id="hmrc-statement-box" aria-live="polite">
            <p><strong>Your starter statement:</strong> <span id="hmrc-statement">answer the questions above</span></p>
          </div>
          <input type="hidden" id="hmrcStatement" value="">`,
        ].join(''))
      + section('Student loans', [
          yn('hasStudentLoan', 'Do you have a student loan or postgraduate loan that is not fully repaid?', { reveal: 'cond-studentLoan' }),
          cond('cond-studentLoan', [
            '<p class="choice-label">Tick all plans that apply:</p>',
            chk('loanPlan1', 'Student Loan Plan 1'),
            chk('loanPlan2', 'Student Loan Plan 2'),
            chk('loanPlan4', 'Student Loan Plan 4 (Scotland)'),
            chk('loanPostgrad', 'Postgraduate Loan'),
          ].join('')),
        ].join(''));
  },

  health() {
    const rows = HEALTH_CONDITIONS.map(([id, label]) =>
      yn(id, label, { req: true, reveal: `cond-${id}` }) +
      cond(`cond-${id}`, ta(`${id}-detail`, 'Please give details', { req: true }))
    ).join('');
    return `<div class="info-box"><strong>Strictly confidential.</strong> This questionnaire contains
        special category health data and is reviewed only by authorised staff.</div>`
      + personalDetailsSection({ sex: true, homePhone: true })
      + section('Medical history — do you have, or have you ever had:', rows)
      + section('Work-related questions', [
          yn('nightDuties', 'Are you able to undertake night duties if required?', { req: true }),
          fld('sickDays', 'How many days of sickness absence have you had in the last 2 years?', { type: 'number', req: true }),
          yn('longIllness', 'Have you had any illness lasting more than one week in the last 2 years?', { req: true, reveal: 'cond-longIllness' }),
          cond('cond-longIllness', ta('longIllnessDetail', 'Please give details', { req: true })),
          yn('impairment', 'Do you have a physical or mental impairment that could affect your work?', { req: true, reveal: 'cond-impairment' }),
          cond('cond-impairment', ta('impairmentAdjustments', 'What adjustments would help you do this job safely?', { req: true })),
        ].join(''));
  },

  hepb() {
    return section('Your details (from your profile)', pre('pf-name', 'Full name', fullName()))
      + section('Vaccination status', [
          yn('hepbVaccinated', 'Have you been vaccinated against Hepatitis B?', { req: true, reveal: 'cond-hepb' }),
          cond('cond-hepb', repeater('dose', doseBlock(1), 'dose', { max: 3 })),
        ].join(''));
  },

  covid() {
    return section('Your details (from your profile)', pre('pf-name', 'Full name', fullName()))
      + section('COVID-19 vaccination', [
          yn('covidVaccinated', 'Have you been vaccinated against COVID-19?', { req: true, reveal: 'cond-covidYes' }),
          cond('cond-covidYes', `<div class="grid-3">
              ${fld('covidDose1', '1st dose date', { type: 'date' })}
              ${fld('covidDose2', '2nd dose date', { type: 'date' })}
              ${fld('covidBooster', 'Booster date', { type: 'date' })}
            </div>
            ${sel('covidManufacturer', 'Vaccine manufacturer', ['Pfizer-BioNTech', 'AstraZeneca', 'Moderna', 'Novavax', 'Other'])}`),
          `<div class="conditional" id="cond-covidNo">${ta('covidNoReason', 'Please tell us why you have not been vaccinated')}</div>`,
        ].join(''));
  },

  gdpr() {
    const consentRows = [
      ['Personal contact details', 'Recruitment, employment administration and contact', '6 months after employment ends', 'gdpr-contact'],
      ['Bank account details', 'Paying your salary', '3 years after employment ends', 'gdpr-bank'],
      ['NI number & tax information', 'HMRC reporting and payroll', 'Up to 7 years (HMRC requirement)', 'gdpr-tax'],
      ['Health information', 'Safe working adjustments and occupational health', 'Duration of employment', 'gdpr-health'],
      ['Emergency contact details', 'Contacting your nominated person in an emergency', 'Duration of employment', 'gdpr-emergency'],
      ['DBS check information', 'Safer recruitment (CQC Regulation 19)', '6 months after decision', 'gdpr-dbs'],
      ['Right-to-work documents', 'Legal compliance (Immigration, Asylum and Nationality Act 2006)', '2 years after employment ends', 'gdpr-rtw'],
      ['Photograph', 'Staff ID badge and care records', 'Duration of employment', 'gdpr-photo'],
    ];
    const agencyRows = [
      ['HM Revenue & Customs (HMRC)', 'Tax and National Insurance', 'share-hmrc'],
      ['NHS Occupational Health provider', 'Fitness-to-work assessments', 'share-occhealth'],
      ['Disclosure and Barring Service (DBS)', 'Criminal record checks', 'share-dbs'],
      ['Local Authority / Care Quality Commission', 'Regulatory inspections and safeguarding', 'share-cqc'],
      ['Workplace pension provider', 'Auto-enrolment pension administration', 'share-pension'],
    ];
    return section('Consent to process your data', `<table class="consent-table">
        <thead><tr><th scope="col">Data type</th><th scope="col">Purpose</th><th scope="col">Retention period</th><th scope="col">I consent</th></tr></thead>
        <tbody>${consentRows.map(([type, purpose, retention, id]) => `
          <tr><td>${type}</td><td>${purpose}</td><td>${retention}</td>
            <td><input type="checkbox" id="${id}" data-req="true" aria-label="Consent: ${escH(type)}"></td></tr>`).join('')}
        </tbody></table>`)
      + section('Data sharing permissions', `<table class="consent-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Purpose</th><th scope="col">I agree</th></tr></thead>
        <tbody>${agencyRows.map(([agency, purpose, id]) => `
          <tr><td>${agency}</td><td>${purpose}</td>
            <td><input type="checkbox" id="${id}" data-req="true" aria-label="Share with ${escH(agency)}"></td></tr>`).join('')}
        </tbody></table>`)
      + section('Declaration', `<div class="declaration">
          <p>I, <strong>${escH(fullName())}</strong>, confirm that I have read and understood how
          Brighter Living Care Ltd will use my personal data, and that I may withdraw my consent
          at any time by contacting the Data Protection Lead.</p></div>
          ${chk('gdprDeclaration', 'I agree to the above declaration', { req: true })}`);
  },

  confidentiality() {
    return section('Confidentiality agreement', `<div class="declaration">
        <p>I, <strong>${escH(fullName())}</strong>, understand that in the course of my employment with
        Brighter Living Care Ltd I will have access to confidential information about the people we
        support, their families, and the company's business.</p>
        <p>I agree that I will not, during or after my employment, disclose any confidential
        information to any unauthorised person. I understand that breach of this agreement may
        result in disciplinary action up to and including dismissal, and may constitute a breach
        of the UK GDPR and the Data Protection Act 2018.</p>
        <p>I understand that this duty of confidentiality does not prevent me from raising
        safeguarding concerns through the proper channels, or from making a protected disclosure
        under the Public Interest Disclosure Act 1998.</p></div>
        ${chk('confidentialityAgreed', 'I have read, understood and agree to this confidentiality agreement', { req: true })}
        <div class="info-box">The Registered Manager will countersign this agreement separately.</div>`);
  },

  criminal() {
    const p = state.profile;
    return section('Self-declaration', `<div class="declaration">
        <p>I, <strong>${escH(fullName())}</strong>, of <strong>${escH(fullAddr())}</strong>,
        born <strong>${escH(formatDate(p.dob))}</strong>, declare the following in relation to
        criminal records. This role is exempt from the Rehabilitation of Offenders Act 1974 —
        you must declare all convictions, cautions, reprimands and warnings, including those
        considered "spent".</p></div>`)
      + section('Declaration', [
          yn('hasConvictions', 'Do you have any convictions, cautions, reprimands or warnings to declare?', { req: true, reveal: 'cond-convictions' }),
          cond('cond-convictions', ta('convictionsDetail', 'Please give full details, including dates', { req: true })),
        ].join(''));
  },

  wtd() {
    return section('Working Time Regulations — 48-hour opt-out', `<div class="declaration">
        <p><strong>To: The Manager, Brighter Living Care Ltd</strong></p>
        <p>I, <strong>${escH(fullName())}</strong>, agree that I may work more than an average of
        48 hours a week. I understand that the Working Time Regulations 1998 limit average weekly
        working time to 48 hours unless I agree otherwise in writing.</p>
        <p>I understand that I can cancel this agreement at any time by giving 3 months' written
        notice, and that I will not be treated unfairly for doing so.</p></div>
        ${chk('wtdAgreed', 'I agree to opt out of the 48-hour average weekly working time limit', { req: true })}`);
  },

  offer() {
    const o = state.offer;
    return section('Offer of employment', `<div class="declaration">
        <p>Dear <strong>${escH(fullName() || 'Candidate')}</strong>,</p>
        <p>We are delighted to offer you the position of <strong>${escH(o.role)}</strong> with
        Brighter Living Care Ltd, subject to satisfactory references, an enhanced DBS check, and
        proof of your right to work in the UK.</p>
        <p><strong>Start date:</strong> ${escH(formatDate(o.startDate))}<br>
        <strong>Hours:</strong> ${escH(o.hours)}<br>
        <strong>Salary:</strong> ${escH(o.salary)}<br>
        <strong>Reports to:</strong> ${escH(o.manager)}</p>
        <p>Your employment is subject to the terms of the full contract of employment, including a
        6-month probationary period, 28 days' annual leave (inclusive of bank holidays, pro rata),
        and auto-enrolment into the workplace pension scheme.</p></div>`)
      + section('Acceptance', `
          ${chk('offerAccepted', 'I accept this offer of employment and the contract terms set out above', { req: true })}
          ${fld('commencementDate', 'Intended commencement date', { type: 'date', req: true })}`);
  },

  supervision() {
    return section('Supervision contract', `<div class="declaration">
        <p>Supervision at Brighter Living Care Ltd takes place at least every 6–8 weeks, lasts
        approximately one hour, and is held in a private setting at your usual place of work or
        another agreed location.</p>
        <p>Supervision is a two-way process. Records of each session are agreed and signed by both
        parties, stored confidentially in your personnel file, and may be reviewed by the Care
        Quality Commission during inspection.</p>
        <p>As a supervisee you agree to: attend sessions prepared, reflect openly on your practice,
        raise concerns promptly, agree actions and carry them out, and use supervision to support
        your professional development.</p></div>`)
      + section('Acknowledgement',
          chk('supervisionAgreed', 'I have read and agree to the supervision contract', { req: true }));
  },

  reg19() {
    const p = state.profile;
    const yob = p.dob ? String(new Date(p.dob).getFullYear()) : '';
    return `<div class="info-box">This full employment history is required to satisfy CQC
        Regulation 19 (Schedule 3). Please account for <strong>all</strong> periods since leaving
        school, including any gaps.</div>`
      + section('Your details (from your profile)', `<div class="grid-3">
          ${pre('pf-name', 'Full name', fullName())}
          ${pre('pf-yob', 'Year of birth', yob)}
          ${pre('pf-start', 'Start date with Brighter Living', formatDate(state.offer.startDate))}
        </div>`)
      + section('Education', fld('schoolLeavingDate', 'Date you left school / full-time education', { type: 'month', req: true }))
      + section('Full employment history (most recent first)',
          repeater('employment-month', empEntryBlock(1, { monthFormat: true }) + empEntryBlock(2, { monthFormat: true }), 'employment entry'))
      + section('Gaps in employment — please account for all periods of non-employment',
          repeater('gap', gapEntryBlock(1), 'gap entry'));
  },
};

/* ---------- conditional + repeater wiring ---------- */

function wireConditionals(root) {
  root.addEventListener('change', e => {
    const radio = e.target;
    if (radio.type !== 'radio' || !radio.dataset.reveal) return;
    const target = document.getElementById(radio.dataset.reveal);
    if (target) target.classList.toggle('visible', radio.checked && radio.value === radio.dataset.revealOn);
    // COVID form: "No" reveals its own reason field
    if (radio.name === 'covidVaccinated') {
      const noBox = document.getElementById('cond-covidNo');
      if (noBox) noBox.classList.toggle('visible', radio.value === 'No' && radio.checked);
    }
  });
}

function wireRepeaters(root) {
  root.addEventListener('click', e => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const rep = root.querySelector(`[data-repeater="${addBtn.dataset.add}"]`);
      if (rep) addEntry(rep);
      return;
    }
    const removeBtn = e.target.closest('.remove-entry');
    if (removeBtn) removeEntry(removeBtn.closest('.emp-block'));
  });
}

// HMRC statement A/B/C branching (requirements §5, HMRC Starter Checklist)
function wireHmrc(root) {
  const update = () => {
    const get = name => root.querySelector(`input[name="${name}"]:checked`)?.value;
    const firstJob = get('hmrcFirstJob');
    const otherPayments = get('hmrcOtherPayments');
    const anotherJob = get('hmrcAnotherJob');
    const out = document.getElementById('hmrc-statement');
    const hidden = document.getElementById('hmrcStatement');
    if (!out || !hidden) return;
    if (!firstJob || !otherPayments || !anotherJob) {
      out.textContent = 'answer the questions above';
      hidden.value = '';
      return;
    }
    let statement;
    if (anotherJob === 'Yes') {
      statement = 'C — I have another job or receive a pension';
    } else if (firstJob === 'Yes' && otherPayments === 'No') {
      statement = 'A — This is my first job since 6 April';
    } else {
      statement = 'B — This is now my only job, but I have had another job or received taxable benefits since 6 April';
    }
    out.textContent = `Statement ${statement}`;
    hidden.value = statement.charAt(0);
  };
  root.addEventListener('change', e => {
    if (['hmrcFirstJob', 'hmrcOtherPayments', 'hmrcAnotherJob'].includes(e.target.name)) update();
  });
  update(); // reflect any radios already checked (e.g. restored from a saved draft)
}

/* ---------- collectFormData (TASK 1.2) ---------- */

const KIND_KEYS = {
  employment: 'employmentHistory',
  'employment-month': 'employmentHistory',
  gap: 'gaps',
  education: 'education',
  cpd: 'cpd',
  referee: 'referees',
  contact: 'emergencyContacts',
  dose: 'doses',
};

// Returns a plain object of field values for the given form id.
// Called by submitForm(id) just before recording the submission.
export function collectFormData(id) {
  const root = document.getElementById('form-body');
  if (!root) return {};
  const data = {};

  // Simple fields by id (outside repeater blocks); includes pre-filled read-only fields.
  root.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
    if (el.closest('.emp-block')) return;
    if (el.type === 'radio') return;
    if (el.type === 'checkbox') { data[el.id] = el.checked; return; }
    data[el.id] = (el.value || '').trim();
  });

  // Radio groups: one entry per name
  const seen = new Set();
  root.querySelectorAll('input[type="radio"]').forEach(radio => {
    if (radio.closest('.emp-block') || seen.has(radio.name)) return;
    seen.add(radio.name);
    const checked = root.querySelector(`input[type="radio"][name="${radio.name}"]:checked`);
    data[radio.name] = checked ? checked.value : '';
  });

  // Repeater rows → arrays of objects keyed by data-field
  root.querySelectorAll('.emp-block').forEach(block => {
    const key = KIND_KEYS[block.dataset.kind] || block.dataset.kind;
    const row = {};
    block.querySelectorAll('[data-field]').forEach(el => {
      row[el.dataset.field] = el.type === 'checkbox' ? el.checked : (el.value || '').trim();
    });
    (data[key] = data[key] || []).push(row);
  });

  return data;
}

/* ---------- populate a locked form from stored data ---------- */

function populateForm(root, data) {
  // Grow repeaters to match stored array lengths
  root.querySelectorAll('[data-repeater]').forEach(rep => {
    const key = KIND_KEYS[rep.dataset.repeater] || rep.dataset.repeater;
    const rows = data[key];
    if (!Array.isArray(rows)) return;
    while (rep.querySelectorAll('.emp-block').length < rows.length) addEntry(rep);
    while (rep.querySelectorAll('.emp-block').length > rows.length && rep.querySelector('.emp-block')) {
      rep.querySelector('.emp-block:last-child').remove();
    }
  });

  // Distribute repeater values in document order per kind
  const counters = {};
  root.querySelectorAll('.emp-block').forEach(block => {
    const key = KIND_KEYS[block.dataset.kind] || block.dataset.kind;
    const i = counters[key] = (counters[key] ?? -1) + 1;
    const row = data[key]?.[i];
    if (!row) return;
    block.querySelectorAll('[data-field]').forEach(el => {
      const v = row[el.dataset.field];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v ?? '';
    });
  });

  // Simple fields + checkboxes + radios
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) return;
    const el = root.querySelector(`#${CSS.escape(key)}`);
    if (el) {
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = value ?? '';
      return;
    }
    const radio = root.querySelector(`input[type="radio"][name="${CSS.escape(key)}"][value="${CSS.escape(String(value))}"]`);
    if (radio) {
      radio.checked = true;
      if (radio.dataset.reveal) {
        const target = root.querySelector(`#${CSS.escape(radio.dataset.reveal)}`);
        if (target) target.classList.toggle('visible', value === radio.dataset.revealOn);
      }
      if (key === 'covidVaccinated' && value === 'No') {
        root.querySelector('#cond-covidNo')?.classList.add('visible');
      }
    }
  });
}

/* ---------- openForm ---------- */

export function openForm(id) {
  const form = FORMS.find(f => f.id === id);
  if (!form) return;

  const sub = state.submissions[id];
  const locked = sub?.status === 'completed';

  document.getElementById('form-title').textContent = form.name;
  const body = document.getElementById('form-body');
  body.innerHTML = FORM_BODIES[id]();
  body.classList.toggle('locked', locked);

  const banner = document.getElementById('form-locked-banner');
  const sigArea = document.getElementById('sig-area');

  if (locked) {
    banner.style.display = 'block';
    banner.innerHTML = `&#10003; <strong>Submitted</strong> on ${escH(formatDate(sub.signedAt))}
      &middot; Signed by <span class="sig-display">${escH(sub.signedName)}</span>`;
    sigArea.style.display = 'none';
    populateForm(body, sub.data || {});
    body.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = true; });
  } else {
    banner.style.display = 'none';
    sigArea.style.display = 'block';
    wireConditionals(body);
    wireRepeaters(body);
    // Restore whatever was saved via "Save & close" on a previous visit.
    if (sub?.data && Object.keys(sub.data).length) populateForm(body, sub.data);
    wireLiveValidation(body);
    if (id === 'hmrc') wireHmrc(body); // reflects any radios just restored above
    wireSignature(id);
    if (!sub) {
      state.submissions[id] = { status: 'in_progress', data: {}, signedName: null, signedAt: null };
      reportProgress(id, 'in_progress');
    }
  }

  showView('view-form');
}
