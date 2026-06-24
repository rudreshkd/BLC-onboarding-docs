// downloads.js — Downloads view, generateFormHTML with real data (TASK 1.5),
// single + bulk ZIP downloads with a branded Start_Here.html cover sheet

import {
  state, FORMS, FILE_NAMES, CATEGORIES, escH, fullName, fullAddr,
  statusOf, formatDate,
} from './state.js';
import { showView } from './nav.js';
import { showToast } from './toast.js';

/* ---------- label dictionary for downloaded documents ---------- */

const LABELS = {
  bankName: 'Bank or building society', accountNumber: 'Account number', sortCode: 'Sort code',
  bankComments: 'Comments', hmrcStatement: 'HMRC starter statement',
  hasStudentLoan: 'Student loan to repay', loanPlan1: 'Plan 1', loanPlan2: 'Plan 2',
  loanPlan4: 'Plan 4 (Scotland)', loanPostgrad: 'Postgraduate loan',
  hmrcFirstJob: 'First job since 6 April', hmrcOtherPayments: 'Other payments since 6 April',
  hmrcAnotherJob: 'Another job or pension',
  eligRightToWork: 'Right to work in the UK', eligDbs: 'Willing to undergo DBS check',
  eligBarred: 'On a barred list', eligBarredDetail: 'Barred list details',
  priorConnection: 'Previous Brighter Living connection', priorConnectionDetail: 'Connection details',
  otherCommitments: 'Other commitments', otherCommitmentsDetail: 'Commitment details',
  currentlyEmployed: 'Currently employed', noticePeriod: 'Notice period',
  gapsExplanation: 'Gaps in employment', skillsStatement: 'Skills and experience',
  sleepInShifts: 'Willing to work sleep-in shifts', drivingLicence: 'Full UK driving licence',
  covidVaccinated: 'COVID-19 vaccinated', talentPoolConsent: 'Talent pool consent',
  medicalConditions: 'Medical conditions / medication', otherComments: 'Other comments',
  leavingDate: 'Leaving date', interests: 'Personal interests',
  nightDuties: 'Able to undertake night duties', sickDays: 'Sick days in last 2 years',
  longIllness: 'Illness over one week', longIllnessDetail: 'Illness details',
  impairment: 'Physical or mental impairment', impairmentAdjustments: 'Adjustments needed',
  hepbVaccinated: 'Hepatitis B vaccinated',
  covidDose1: '1st dose date', covidDose2: '2nd dose date', covidBooster: 'Booster date',
  covidManufacturer: 'Vaccine manufacturer', covidNoReason: 'Reason not vaccinated',
  gdprDeclaration: 'GDPR declaration agreed', confidentialityAgreed: 'Confidentiality agreement accepted',
  hasConvictions: 'Convictions to declare', convictionsDetail: 'Conviction details',
  wtdAgreed: '48-hour opt-out agreed', offerAccepted: 'Offer accepted',
  commencementDate: 'Intended commencement date', supervisionAgreed: 'Supervision contract agreed',
  schoolLeavingDate: 'Left full-time education',
  employmentHistory: 'Employment history', gaps: 'Gaps in employment', education: 'Education',
  cpd: 'Training & CPD', referees: 'Referees', emergencyContacts: 'Emergency contacts', doses: 'Vaccination doses',
};

const ROW_LABELS = {
  employer: 'Employer', contact: 'Contact', from: 'From', to: 'To', role: 'Role',
  reason: 'Reason', institution: 'Institution', qualification: 'Qualification',
  course: 'Course', provider: 'Provider', year: 'Year', name: 'Name',
  organisation: 'Organisation', address: 'Address', occupation: 'Occupation',
  phone: 'Phone', email: 'Email', relationship: 'Relationship', altPhone: 'Alt. phone',
  date: 'Date', vaccine: 'Vaccine',
};

function labelFor(key) {
  if (LABELS[key]) return LABELS[key];
  // Humanise camelCase / prefixed keys: 'hc-epilepsy-detail' → 'Hc epilepsy detail'
  return key.replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

function displayValue(key, value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === '' || value === null || value === undefined) return '—';
  // Mask account number: last 4 digits only (TASK 1.5)
  if (key === 'accountNumber' && /^\d{8}$/.test(value)) {
    return '••••' + value.slice(-4);
  }
  return String(value);
}

const LOGO_SVG = `<svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
  <circle cx="24" cy="12" r="7" fill="#fff"/>
  <path d="M24 22 C14 22 8 30 8 42 L24 42 Z" fill="#3D1A6B"/>
  <path d="M24 22 C34 22 40 30 40 42 L24 42 Z" fill="#71DBD4"/>
</svg>`;

/* ---------- shared CSS for every generated document ---------- */

const DOC_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Inter:wght@400;500&display=swap');
body { margin:0; font-family:'Inter',sans-serif; color:#111827; background:#fff; }
h1,h2,h3 { font-family:'Poppins',sans-serif; }
.stripe { height:6px; background:linear-gradient(90deg,#71DBD4 0%,#563D82 55%,#71DBD4 100%); }
header { background:#211733; color:#fff; display:flex; align-items:center; gap:12px; padding:16px 32px; }
header .word { font-family:'Poppins',sans-serif; font-weight:600; font-size:18px; flex:1; }
header .tag { background:#563D82; border-radius:999px; padding:4px 14px; font-size:12px; }
header .ref { font-size:12px; color:#9D93B8; margin-left:12px; }
.title-band { padding:24px 32px 8px; }
.title-band h1 { margin:0; color:#3D1A6B; font-size:24px; }
.status { margin:8px 32px 24px; padding:12px 18px; border-radius:10px; font-size:14px; }
.status.done { background:#F0EBF9; border:1px solid #563D82; color:#3D1A6B; }
.status.pending { background:#FCF1E0; border:1px solid #C97B0A; color:#C97B0A; }
.details, .content { margin:0 32px 24px; }
.details { display:grid; grid-template-columns:repeat(3,1fr); gap:8px 24px; background:#F6F3FC;
  border:1px solid #DCD5ED; border-radius:10px; padding:18px; font-size:13.5px; }
.details div b { display:block; color:#5C4E72; font-size:11.5px; font-weight:600; text-transform:uppercase; }
table.answers { width:100%; border-collapse:collapse; font-size:13.5px; margin-bottom:18px; }
table.answers th, table.answers td { border:1px solid #DCD5ED; padding:8px 12px; text-align:left; vertical-align:top; }
table.answers th { background:#F0EBF9; color:#3D1A6B; font-family:'Poppins',sans-serif; font-weight:600; width:38%; }
table.answers.sub th { width:auto; }
.content h3 { color:#3D1A6B; font-size:15px; margin:20px 0 8px; }
.blank-note { background:#E0F7F7; border:1px solid #71DBD4; border-radius:10px; padding:14px 18px; font-size:14px; }
.sig-record { margin:0 32px 24px; border-top:2px solid #563D82; padding-top:14px; }
.sig-name { font-family:'Brush Script MT','Segoe Script',cursive; font-size:30px; color:#3D1A6B; margin:0; }
.sig-meta { font-size:12.5px; color:#5C4E72; margin:4px 0 0; }
footer { background:#211733; color:#9D93B8; font-size:12px; padding:16px 32px; margin-top:32px; }
@media print { footer { position:fixed; bottom:0; left:0; right:0; } }
`;

/* ---------- generateFormHTML (TASK 1.5) ---------- */

// The inner content for one form: title, status, profile details, answers,
// signature. Shared between the standalone per-form document and the combined
// single-document download (each form becomes one <section> in that doc).
function formSectionHTML(id) {
  const form = FORMS.find(f => f.id === id);
  const sub = state.submissions[id];
  const completed = sub?.status === 'completed';
  const p = state.profile;
  const docRef = `BLC-ONB-${id.toUpperCase()}`;

  const statusBlock = completed
    ? `<div class="status done">&#10003; Submitted on ${escH(formatDate(sub.signedAt))} &middot; Signed by ${escH(sub.signedName)}</div>`
    : `<div class="status pending">&#9203; Not yet submitted</div>`;

  // Form answers section: simple fields → two-column table; arrays → sub-tables.
  let answers = '';
  if (completed && sub.data && Object.keys(sub.data).length) {
    const simple = [];
    const arrays = [];
    Object.entries(sub.data).forEach(([key, value]) => {
      if (Array.isArray(value)) arrays.push([key, value]);
      else if (!key.startsWith('pf-')) simple.push([key, value]); // pf-* echo the profile grid
    });

    if (simple.length) {
      answers += `<table class="answers">
        ${simple.map(([k, v]) => `<tr><th>${escH(labelFor(k))}</th><td>${escH(displayValue(k, v))}</td></tr>`).join('')}
      </table>`;
    }
    arrays.forEach(([key, rows]) => {
      if (!rows.length) return;
      const cols = Object.keys(rows[0]);
      answers += `<h3>${escH(labelFor(key))}</h3>
        <table class="answers sub">
          <tr>${cols.map(c => `<th>${escH(ROW_LABELS[c] || labelFor(c))}</th>`).join('')}</tr>
          ${rows.map(row => `<tr>${cols.map(c => `<td>${escH(displayValue(c, row[c]))}</td>`).join('')}</tr>`).join('')}
        </table>`;
    });
  } else {
    answers = `<p class="blank-note">This form has not been completed yet. This is a blank template —
      log in to the onboarding portal to fill it in.</p>`;
  }

  const signature = completed
    ? `<div class="sig-record">
        <p class="sig-name">${escH(sub.signedName)}</p>
        <p class="sig-meta">Signed electronically on ${escH(new Date(sub.signedAt).toLocaleString('en-GB'))}</p>
      </div>`
    : '';

  return `<div class="title-band"><h1>${escH(form.name)}</h1></div>
${statusBlock}
<div class="details">
  <div><b>Name</b>${escH(fullName() || '—')}</div>
  <div><b>Date of birth</b>${escH(formatDate(p.dob) || '—')}</div>
  <div><b>NI number</b>${escH(p.ni || '—')}</div>
  <div><b>Mobile</b>${escH(p.mobile || '—')}</div>
  <div><b>Email</b>${escH(p.email || '—')}</div>
  <div><b>Address</b>${escH(fullAddr() || '—')}</div>
</div>
<div class="content">${answers}</div>
${signature}`;
}

export function generateFormHTML(id) {
  const form = FORMS.find(f => f.id === id);
  const docRef = `BLC-ONB-${id.toUpperCase()}`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<title>${escH(form.name)} — Brighter Living Care Ltd</title>
<style>${DOC_STYLE}</style>
</head>
<body>
<div class="stripe"></div>
<header>${LOGO_SVG}<span class="word">Brighter Living</span><span class="tag">Onboarding</span><span class="ref">${docRef}</span></header>
${formSectionHTML(id)}
<footer>Brighter Living Care Ltd &middot; Registered in England &amp; Wales &middot; ${docRef}</footer>
</body>
</html>`;
}

// One single HTML document containing every form, in order, with a jump-link
// table of contents — opens directly in a browser, no ZIP/extraction needed.
export function generateCombinedHTML() {
  const toc = CATEGORIES.map(cat => {
    const items = FORMS.filter(f => f.category === cat)
      .map(f => `<li><a href="#form-${escH(f.id)}">${escH(f.name)}</a></li>`).join('');
    return `<h3>${escH(cat)}</h3><ul>${items}</ul>`;
  }).join('');

  const sections = FORMS.map(f => `
    <section id="form-${escH(f.id)}" class="form-section">
      ${formSectionHTML(f.id)}
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<title>Onboarding Pack (combined) — Brighter Living Care Ltd</title>
<style>${DOC_STYLE}
.toc { margin:0 32px 24px; }
.toc h3 { color:#3D1A6B; font-size:14px; margin:16px 0 6px; }
.toc ul { list-style:none; margin:0; padding:0; columns:2; }
.toc a { color:#563D82; text-decoration:none; font-weight:600; font-size:13.5px; line-height:1.9; }
.toc a:hover { text-decoration:underline; }
.form-section { border-top:4px solid #71DBD4; padding-top:8px; }
.form-section:first-of-type { border-top:none; }
@media print { .form-section { page-break-before:always; } .form-section:first-of-type { page-break-before:avoid; } }
</style>
</head>
<body>
<div class="stripe"></div>
<header>${LOGO_SVG}<span class="word">Brighter Living</span><span class="tag">Onboarding</span></header>
<div class="title-band"><h1>Your Onboarding Pack — All Forms</h1></div>
<div class="toc"><p>Jump to a form:</p>${toc}</div>
${sections}
<footer>Brighter Living Care Ltd &middot; Registered in England &amp; Wales</footer>
</body>
</html>`;
}

/* ---------- download helpers ---------- */

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadSingle(id) {
  const html = generateFormHTML(id);
  triggerDownload(new Blob([html], { type: 'text/html' }), FILE_NAMES[id]);
}

// Branded cover sheet (replaces the old plain-text README.txt) — same template
// chrome as generateFormHTML, lists every form's status, and links both to the
// other files in the pack and back to the live portal.
function generateCoverHTML(foldered) {
  const portalUrl = `${location.origin}${location.pathname}`;
  const rows = CATEGORIES.map(cat => {
    const forms = FORMS.filter(f => f.category === cat);
    const items = forms.map(f => {
      const done = statusOf(f.id) === 'completed';
      const href = foldered ? `${f.category}/${FILE_NAMES[f.id]}` : FILE_NAMES[f.id];
      const mark = done
        ? '<span class="tick">&#10003; Completed</span>'
        : '<span class="pending">Not yet completed</span>';
      return `<tr><td><a href="${escH(href)}">${escH(f.name)}</a></td><td>${mark}</td></tr>`;
    }).join('');
    return `<h3>${escH(cat)}</h3><table class="answers"><tbody>${items}</tbody></table>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<title>Onboarding Pack — Brighter Living Care Ltd</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Inter:wght@400;500&display=swap');
body { margin:0; font-family:'Inter',sans-serif; color:#111827; background:#fff; }
h1,h2,h3 { font-family:'Poppins',sans-serif; }
.stripe { height:6px; background:linear-gradient(90deg,#71DBD4 0%,#563D82 55%,#71DBD4 100%); }
header { background:#211733; color:#fff; display:flex; align-items:center; gap:12px; padding:16px 32px; }
header .word { font-family:'Poppins',sans-serif; font-weight:600; font-size:18px; flex:1; }
header .tag { background:#563D82; border-radius:999px; padding:4px 14px; font-size:12px; }
.title-band { padding:24px 32px 8px; }
.title-band h1 { margin:0; color:#3D1A6B; font-size:24px; }
.content { margin:0 32px 24px; }
.content h3 { color:#3D1A6B; font-size:15px; margin:20px 0 8px; }
table.answers { width:100%; border-collapse:collapse; font-size:13.5px; margin-bottom:8px; }
table.answers td { border:1px solid #DCD5ED; padding:8px 12px; text-align:left; }
table.answers a { color:#563D82; font-weight:600; text-decoration:none; }
table.answers a:hover { text-decoration:underline; }
.tick { color:#0a6b54; font-weight:600; }
.pending { color:#C97B0A; }
.return-link { margin:0 32px 24px; }
.return-link a {
  display:inline-block; background:#F3D400; color:#211733; font-weight:600;
  padding:12px 22px; border-radius:8px; text-decoration:none; font-family:'Poppins',sans-serif;
}
footer { background:#211733; color:#9D93B8; font-size:12px; padding:16px 32px; margin-top:32px; }
</style>
</head>
<body>
<div class="stripe"></div>
<header>${LOGO_SVG}<span class="word">Brighter Living</span><span class="tag">Onboarding</span></header>
<div class="title-band"><h1>Your Onboarding Pack</h1></div>
<div class="content">
  <p><strong>Candidate:</strong> ${escH(fullName() || 'Not yet provided')}<br>
  <strong>Generated:</strong> ${escH(new Date().toLocaleString('en-GB'))}</p>
  <p>Click any form below to open it, or open <a href="All_Forms_Combined.html">All_Forms_Combined.html</a>
  to read every form in a single document. Forms you haven't finished yet are included as blank templates.</p>
  ${rows}
</div>
<div class="return-link"><a href="${escH(portalUrl)}">&larr; Return to your onboarding portal</a></div>
<footer>Brighter Living Care Ltd &middot; Registered in England &amp; Wales</footer>
</body>
</html>`;
}

// Builds the candidate pack ZIP. foldered=true organises into category subfolders.
export async function buildZip(foldered) {
  const zip = new JSZip();
  zip.file('Start_Here.html', generateCoverHTML(foldered));
  zip.file('All_Forms_Combined.html', generateCombinedHTML()); // root, regardless of foldered
  FORMS.forEach(f => {
    const html = generateFormHTML(f.id);
    const path = foldered ? `${f.category}/${FILE_NAMES[f.id]}` : FILE_NAMES[f.id];
    zip.file(path, html);
  });
  return zip.generateAsync({ type: 'blob' });
}

async function bulkDownload(btn, foldered, filename) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing ZIP…';
  try {
    const blob = await buildZip(foldered);
    triggerDownload(blob, filename);
  } catch {
    showToast('Sorry — the ZIP could not be generated. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

export function downloadAllFlat(btn) {
  return bulkDownload(btn, false, 'Brighter_Living_Onboarding_Pack.zip');
}

export function downloadFoldered(btn) {
  return bulkDownload(btn, true, 'Brighter_Living_Onboarding_Pack_Folders.zip');
}

// A single HTML file with every form — opens directly in a browser, no ZIP
// extraction needed. Same content as All_Forms_Combined.html inside the ZIP.
export function downloadCombined() {
  const html = generateCombinedHTML();
  triggerDownload(new Blob([html], { type: 'text/html' }), 'Brighter_Living_Onboarding_Pack_Combined.html');
}

/* ---------- Downloads view ---------- */

export function renderDownloads() {
  const container = document.getElementById('downloads-list');
  container.innerHTML = CATEGORIES.map(cat => {
    const forms = FORMS.filter(f => f.category === cat);
    return `<div class="section"><h2>${escH(cat)} (${forms.length})</h2><div class="section-body">
      ${forms.map(f => {
        const status = statusOf(f.id);
        const note = status === 'completed' ? 'Completed — includes your answers' : 'Blank template';
        return `<div class="form-row" style="cursor:default">
          <span class="meta"><span class="name">${escH(f.name)}</span><span class="sub">${note}</span></span>
          <span class="right"><button type="button" class="btn btn-secondary" data-download="${f.id}">Download</button></span>
        </div>`;
      }).join('')}
    </div></div>`;
  }).join('');

  container.querySelectorAll('[data-download]').forEach(btn =>
    btn.addEventListener('click', () => downloadSingle(btn.dataset.download)));
}

export function showDownloads() {
  renderDownloads();
  showView('view-downloads');
}

export function wireDownloads() {
  document.getElementById('btn-download-flat').addEventListener('click', e =>
    downloadAllFlat(e.currentTarget));
  document.getElementById('btn-download-folders').addEventListener('click', e =>
    downloadFoldered(e.currentTarget));
  document.getElementById('btn-download-combined').addEventListener('click', downloadCombined);
}
