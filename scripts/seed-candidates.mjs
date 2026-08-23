#!/usr/bin/env node
// seed-candidates.mjs — create demo candidates straight against the API, no browser.
//
// Creates an invite, "logs in" as that candidate via the real magic-link verify
// endpoint, marks all 15 forms complete via the progress endpoint, builds a real
// ZIP pack (reusing the portal's own HTML generators so content matches what the
// candidate portal would produce), and PUTs it to the encrypted pack relay — so
// the result is a fully genuine "submitted, ready to review" candidate.
//
// Usage:
//   HR_PASSWORD='...' node scripts/seed-candidates.mjs
//   HR_PASSWORD='...' node scripts/seed-candidates.mjs --count 3 --style rich --status submitted
//   HR_PASSWORD='...' node scripts/seed-candidates.mjs --count 4 --status in_progress --min-forms 3 --max-forms 9
//   HR_PASSWORD='...' node scripts/seed-candidates.mjs --count 1 --status invited
//   HR_PASSWORD='...' node scripts/seed-candidates.mjs --count 3 --status received
//
// --status invited      invite created, link never opened
// --status in_progress  candidate opened the link, completed a random subset of forms (--min-forms/--max-forms)
// --status submitted    all 15 forms complete, real pack uploaded — "To Review" (default)
// --status received     submitted, then HR confirmed receipt — "Completed"
//
// Env:
//   API_BASE     default http://localhost:3000
//   HR_EMAIL     default hr@brighterliving.co.uk
//   HR_PASSWORD  required

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { state, FORMS, FILE_NAMES, CATEGORIES } from '../portal/js/state.js';
import { generateFormHTML, generateCombinedHTML } from '../portal/js/downloads.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const HR_EMAIL = process.env.HR_EMAIL || 'hr@brighterliving.co.uk';
const HR_PASSWORD = process.env.HR_PASSWORD;

const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? def : args[i + 1];
}
const COUNT = parseInt(argVal('count', '1'), 10);
const STYLE = argVal('style', 'rich'); // 'rich' (Yes + detail text) or 'plain' (No everywhere)
// invited      — invite created, candidate never opened the link
// in_progress  — candidate opened the link, completed some (not all) forms
// submitted    — all 15 forms complete, pack uploaded, awaiting HR review
// received     — submitted, then HR confirmed receipt (pack purged)
const STATUS = argVal('status', 'submitted');
const MIN_FORMS = parseInt(argVal('min-forms', '3'), 10);
const MAX_FORMS = parseInt(argVal('max-forms', '9'), 10);

if (!HR_PASSWORD) {
  console.error('Set HR_PASSWORD (the local HR dashboard login password) in the environment.');
  process.exit(1);
}

const FIRST_NAMES = ['Alex', 'Sam', 'Robin', 'Casey', 'Taylor', 'Jamie', 'Morgan', 'Drew', 'Charlie', 'Reese'];
const LAST_NAMES = ['Turner', 'Nguyen', 'Adeyemi', 'Fischer', 'Molina', 'Osei', 'Whitfield', 'Yıldız', 'Barrett', 'Sato'];
const ROLES = ['Support Worker', 'Senior Support Worker', 'Team Leader', 'Care Coordinator', 'Registered Nurse'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pad(n) { return String(n).padStart(2, '0'); }
function randomDate(startYear, endYear) {
  const y = startYear + Math.floor(Math.random() * (endYear - startYear));
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 28);
  return `${y}-${pad(m)}-${pad(d)}`;
}
function niNumber() {
  const letters = () => String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const digits = () => String(Math.floor(100000 + Math.random() * 900000));
  return `${letters()}${digits()}C`;
}

async function api(path, { method = 'GET', body, token, raw = false } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': raw ? 'application/zip' : 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.arrayBuffer();
}

function yn(preferYes) { return preferYes ? 'Yes' : 'No'; }

function buildSubmissions(rich) {
  const now = new Date().toISOString();
  const detail = 'Full details provided on request — see attached notes for context.';
  const sign = (data) => ({ status: 'completed', data, signedName: `${state.profile.firstName} ${state.profile.lastName}`, signedAt: now });

  const application = sign({
    eligRightToWork: 'Yes',
    eligDbs: 'Yes',
    eligBarred: yn(rich), ...(rich ? { eligBarredDetail: detail } : {}),
    priorConnection: yn(rich), ...(rich ? { priorConnectionDetail: detail } : {}),
    otherCommitments: yn(rich), ...(rich ? { otherCommitmentsDetail: detail } : {}),
    currentlyEmployed: 'Yes', noticePeriod: '4 weeks',
    gapsExplanation: rich ? 'Career break 2019-2020 for full-time caregiving.' : '',
    skillsStatement: 'Five years of frontline care experience with a focus on dementia support and person-centred care planning.',
    sleepInShifts: 'Yes',
    drivingLicence: 'Yes',
    covidVaccinated: 'Yes',
    talentPoolConsent: true,
    education: [
      { institution: 'Riverside College', qualification: 'NVQ Level 3 Health & Social Care', from: '2014-09', to: '2016-06' },
      { institution: 'Northgate Sixth Form', qualification: 'A-Levels', from: '2012-09', to: '2014-06' },
      { institution: '', qualification: '', from: '', to: '' },
    ],
    cpd: [
      { course: 'Moving & Handling', provider: 'Skills for Care', year: '2024' },
      { course: 'Safeguarding Adults Level 2', provider: 'Skills for Care', year: '2023' },
      { course: '', provider: '', year: '' },
    ],
    employmentHistory: [
      { employer: 'Willow Grove Care Home', contact: '01132 000111', from: '2020-03', to: '2026-08', role: 'Support Worker', reason: 'Seeking career progression' },
      { employer: 'Oakleigh Residential', contact: '01132 000222', from: '2016-07', to: '2020-02', role: 'Care Assistant', reason: 'Relocated' },
    ],
    referees: [
      { name: 'Dana Whitlock', organisation: 'Willow Grove Care Home', address: '12 Willow Grove, Leeds', occupation: 'Registered Manager', phone: '07700900001', email: 'dana.whitlock@example.com' },
      { name: 'Priya Chandra', organisation: 'Oakleigh Residential', address: '4 Oak Lane, Leeds', occupation: 'Deputy Manager', phone: '07700900002', email: 'priya.chandra@example.com' },
      { name: '', organisation: '', address: '', occupation: '', phone: '', email: '' },
    ],
  });

  const staffDetails = sign({
    'emergencyContacts': [
      { name: 'Jamie ' + state.profile.lastName, relationship: 'Partner', phone: '07700900010', altPhone: '', address: state.profile.addr1 },
      { name: '', relationship: '', phone: '', altPhone: '', address: '' },
    ],
    medicalConditions: rich ? 'Mild asthma — carries inhaler, no work restrictions.' : '',
    otherComments: '',
  });

  const staffProfile = sign({
    leavingDate: '',
    interests: 'Hiking, baking, and volunteering with the local community garden.',
  });

  const bank = sign({
    bankName: 'Northern Trust Bank',
    accountNumber: '12345678',
    sortCode: '12-34-56',
    bankComments: '',
  });

  const hmrc = sign({
    hmrcFirstJob: 'No',
    hmrcOtherPayments: 'No',
    hmrcAnotherJob: 'No',
    hmrcStatement: 'B',
    hasStudentLoan: yn(rich),
    ...(rich ? { loanPlan1: false, loanPlan2: true, loanPlan4: false, loanPostgrad: false } : {}),
  });

  const HEALTH_IDS = ['hc-epilepsy', 'hc-diabetes', 'hc-heart', 'hc-asthma', 'hc-back', 'hc-joints',
    'hc-hearing', 'hc-eyesight', 'hc-skin', 'hc-allergies', 'hc-stomach', 'hc-mental', 'hc-neuro',
    'hc-mobility', 'hc-infectious', 'hc-medication', 'hc-other'];
  const healthData = {};
  HEALTH_IDS.forEach((id, i) => {
    // In the rich style, flag a couple of realistic conditions with detail text.
    const flagged = rich && (id === 'hc-asthma' || id === 'hc-back');
    healthData[id] = flagged ? 'Yes' : 'No';
    if (flagged) healthData[`${id}-detail`] = detail;
  });
  const health = sign({
    ...healthData,
    nightDuties: 'Yes',
    sickDays: rich ? '3' : '0',
    longIllness: yn(rich), ...(rich ? { longIllnessDetail: detail } : {}),
    impairment: yn(rich), ...(rich ? { impairmentAdjustments: detail } : {}),
  });

  const hepb = sign({
    hepbVaccinated: 'Yes',
    doses: [
      { date: '2021-04-12', vaccine: 'Engerix B' },
      { date: '2021-05-24', vaccine: 'Engerix B' },
      { date: '2021-10-30', vaccine: 'Engerix B' },
    ],
  });

  const covid = sign({
    covidVaccinated: 'Yes',
    covidDose1: '2021-02-10',
    covidDose2: '2021-04-05',
    covidBooster: '2022-11-15',
    covidManufacturer: 'Pfizer-BioNTech',
    covidNoReason: '',
  });

  const gdprIds = ['gdpr-contact', 'gdpr-bank', 'gdpr-tax', 'gdpr-health', 'gdpr-emergency', 'gdpr-dbs', 'gdpr-rtw', 'gdpr-photo'];
  const shareIds = ['share-hmrc', 'share-occhealth', 'share-dbs', 'share-cqc', 'share-pension'];
  const gdprData = {};
  gdprIds.forEach((id) => { gdprData[id] = true; });
  shareIds.forEach((id) => { gdprData[id] = true; });
  const gdpr = sign({ ...gdprData, gdprDeclaration: true });

  const confidentiality = sign({ confidentialityAgreed: true });

  const criminal = sign({
    hasConvictions: yn(rich),
    ...(rich ? { convictionsDetail: 'Single caution, 2015, unrelated to role — full disclosure provided separately.' } : {}),
  });

  const wtd = sign({ wtdAgreed: true });

  const offer = sign({ offerAccepted: true, commencementDate: state.offer.startDate });

  const supervision = sign({ supervisionAgreed: true });

  const reg19 = sign({
    schoolLeavingDate: '2012-06',
    employmentHistory: [
      { employer: 'Willow Grove Care Home', contact: '01132 000111', from: '03/2020', to: '08/2026', role: 'Support Worker', reason: 'Seeking career progression' },
      { employer: 'Oakleigh Residential', contact: '01132 000222', from: '07/2016', to: '02/2020', role: 'Care Assistant', reason: 'Relocated' },
    ],
    gaps: rich
      ? [{ from: '02/2020', to: '03/2020', reason: 'Between roles — relocation.' }]
      : [{ from: '', to: '', reason: '' }],
  });

  return {
    application, staffDetails, staffProfile, bank, hmrc, health, hepb, covid,
    gdpr, confidentiality, criminal, wtd, offer, supervision, reg19,
  };
}

function buildPackDir(rich) {
  const dir = mkdtempSync(join(tmpdir(), 'bl-pack-'));
  CATEGORIES.forEach((cat) => mkdirSync(join(dir, cat), { recursive: true }));
  writeFileSync(join(dir, 'All_Forms_Combined.html'), generateCombinedHTML());
  writeFileSync(join(dir, 'Start_Here.html'), generateCombinedHTML()); // simple cover stand-in
  FORMS.forEach((f) => {
    const html = generateFormHTML(f.id);
    writeFileSync(join(dir, f.category, FILE_NAMES[f.id]), html);
  });
  return dir;
}

function zipDir(dir) {
  const zipPath = join(dir, '..', `${dir.split('/').pop()}.zip`);
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: dir });
  return zipPath;
}

async function seedOne(i) {
  const firstName = rand(FIRST_NAMES);
  const lastName = rand(LAST_NAMES);
  const role = rand(ROLES);
  const email = `${firstName}.${lastName}.${Date.now()}${i}@example.com`.toLowerCase();
  const rich = STYLE === 'rich';

  console.log(`\n[${i + 1}/${COUNT}] Creating ${firstName} ${lastName} (${role}, style=${STYLE})…`);

  const hrLogin = await api('/hr/auth/login', { method: 'POST', body: { email: HR_EMAIL, password: HR_PASSWORD } });
  const hrToken = hrLogin.token;

  const invite = await api('/invites', {
    method: 'POST',
    token: hrToken,
    body: {
      name: `${firstName} ${lastName}`,
      email,
      role,
      offerTerms: {
        role,
        startDate: randomDate(2026, 2027),
        hours: '37.5 hours per week',
        salary: '£24,960 per annum',
        manager: 'The Registered Manager',
        email,
      },
    },
  });

  if (STATUS === 'invited') {
    console.log(`  → ${firstName} ${lastName}: invite created, link not yet opened.`);
    return;
  }

  const url = new URL(invite.link);
  const token = url.searchParams.get('token');
  const verify = await api('/auth/verify', { method: 'POST', body: { token } }); // flips invited -> in_progress

  // Set up the shared portal `state` singleton for this candidate.
  state.profile = {
    title: rand(['Mr', 'Mrs', 'Ms', 'Mx']),
    firstName, lastName,
    dob: randomDate(1975, 2003),
    sex: rand(['Female', 'Male', 'Prefer not to say']),
    ni: niNumber(),
    addr1: `${1 + Math.floor(Math.random() * 200)} ${rand(['Willow', 'Oak', 'Elm', 'Birch', 'Cedar'])} ${rand(['Lane', 'Road', 'Close', 'Avenue'])}`,
    addr2: '',
    city: rand(['Leeds', 'Manchester', 'Bristol', 'Sheffield', 'Nottingham']),
    county: '',
    postcode: 'LS1 2AB',
    mobile: '07700900' + String(100 + i).padStart(3, '0'),
    homePhone: '',
    email,
  };
  state.offer = { ...state.offer, ...(verify.offerTerms || {}) };
  state.submissions = buildSubmissions(rich);

  if (STATUS === 'in_progress') {
    const n = Math.max(3, MIN_FORMS + Math.floor(Math.random() * (MAX_FORMS - MIN_FORMS + 1)));
    const shuffled = [...FORMS].sort(() => Math.random() - 0.5).slice(0, n);
    for (const f of shuffled) {
      await api(`/invites/${invite.inviteId}/progress`, {
        method: 'PATCH',
        token: verify.sessionToken,
        body: { formId: f.id, status: 'completed' },
      });
    }
    console.log(`  → ${firstName} ${lastName}: ${n}/15 forms completed, in progress.`);
    return;
  }

  // submitted / received: complete every form, then upload a real pack.
  for (const f of FORMS) {
    await api(`/invites/${invite.inviteId}/progress`, {
      method: 'PATCH',
      token: verify.sessionToken,
      body: { formId: f.id, status: 'completed' },
    });
  }

  const dir = buildPackDir(rich);
  const zipPath = zipDir(dir);
  const zipBytes = execFileSync('cat', [zipPath]); // Buffer

  await api(`/packs/${invite.inviteId}`, {
    method: 'PUT',
    token: verify.sessionToken,
    body: zipBytes,
    raw: true,
  });

  rmSync(dir, { recursive: true, force: true });
  rmSync(zipPath, { force: true });

  if (STATUS === 'received') {
    await api(`/packs/${invite.inviteId}/receipt`, { method: 'POST', token: hrToken });
    console.log(`  → ${firstName} ${lastName}: 15/15 forms, pack uploaded and receipt confirmed. Completed.`);
    return;
  }

  console.log(`  → ${firstName} ${lastName}: 15/15 forms, pack uploaded. To Review on the HR dashboard.`);
}

(async () => {
  for (let i = 0; i < COUNT; i++) {
    await seedOne(i);
  }
  console.log(`\nDone — seeded ${COUNT} candidate(s) [status=${STATUS}] against ${API_BASE}.`);
})().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
