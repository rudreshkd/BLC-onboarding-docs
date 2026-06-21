// state.js — central state object, form registry, shared helpers

// Backend origin for the magic-link/progress/pack endpoints. Production serves
// the portal and backend from the same origin (behind a reverse proxy), so
// relative paths work there; local dev runs them on separate ports (the HR
// dashboard's api.js has the same fallback for the same reason).
export const API_BASE = (typeof window !== 'undefined' && window.BL_API_BASE) || 'http://localhost:3000';

export const FORMS = [
  { id: 'application',     name: 'Application Form',                    category: 'Personal Details' },
  { id: 'staffDetails',    name: 'Staff Details & Emergency Contacts',  category: 'Personal Details' },
  { id: 'staffProfile',    name: 'Staff Profile',                       category: 'Personal Details' },
  { id: 'bank',            name: 'Bank Details',                        category: 'Personal Details' },
  { id: 'hmrc',            name: 'HMRC Starter Checklist',              category: 'Pay & Tax' },
  { id: 'health',          name: 'Health Questionnaire',                category: 'Health' },
  { id: 'hepb',            name: 'Hepatitis B Vaccination Record',      category: 'Health' },
  { id: 'covid',           name: 'COVID-19 Vaccination Status',         category: 'Health' },
  { id: 'gdpr',            name: 'GDPR Consent',                        category: 'Consents & Declarations' },
  { id: 'confidentiality', name: 'Confidentiality Agreement',           category: 'Consents & Declarations' },
  { id: 'criminal',        name: 'Criminal Record Self-Declaration',    category: 'Consents & Declarations' },
  { id: 'wtd',             name: 'Working Time Opt-Out',                category: 'Consents & Declarations' },
  { id: 'offer',           name: 'Offer Letter & Contract',             category: 'Contract & Checks' },
  { id: 'supervision',     name: 'Supervision Contract',                category: 'Contract & Checks' },
  { id: 'reg19',           name: 'Employment History (Regulation 19)',  category: 'Contract & Checks' },
];

export const FILE_NAMES = {
  application:     'Application_Form.html',
  staffDetails:    'Staff_Details_Emergency_Contacts.html',
  staffProfile:    'Staff_Profile.html',
  bank:            'Bank_Details.html',
  hmrc:            'HMRC_Starter_Checklist.html',
  health:          'Health_Questionnaire.html',
  hepb:            'Hepatitis_B_Vaccination_Record.html',
  covid:           'COVID19_Vaccination_Status.html',
  gdpr:            'GDPR_Consent.html',
  confidentiality: 'Confidentiality_Agreement.html',
  criminal:        'Criminal_Record_Self_Declaration.html',
  wtd:             'Working_Time_Opt_Out.html',
  offer:           'Offer_Letter_Contract.html',
  supervision:     'Supervision_Contract.html',
  reg19:           'Employment_History_Regulation_19.html',
};

export const CATEGORIES = [
  'Personal Details',
  'Pay & Tax',
  'Health',
  'Consents & Declarations',
  'Contract & Checks',
];

export const state = {
  loggedIn: false,
  // Backend session — set by real magic-link auth (Phase 3). Absent in standalone mode.
  session: null, // { inviteId, token }
  profile: {
    title: '', firstName: '', lastName: '',
    dob: '', sex: '', ni: '',
    addr1: '', addr2: '', city: '', county: '', postcode: '',
    mobile: '', homePhone: '', email: '',
  },
  profileComplete: false,
  // Offer data — provided by HR per candidate in production; placeholder until Phase 3.
  offer: {
    role: 'Support Worker',
    startDate: '2026-07-13',
    hours: '37.5 hours per week',
    salary: '£24,960 per annum',
    manager: 'The Registered Manager',
  },
  // submissions[id] = { status: 'in_progress'|'completed', data: {}, signedName, signedAt }
  submissions: {},
  packSubmitted: false,
};

export function fullName() {
  return [state.profile.title, state.profile.firstName, state.profile.lastName]
    .filter(Boolean).join(' ').trim();
}

export function fullAddr() {
  return [state.profile.addr1, state.profile.addr2, state.profile.city,
          state.profile.county, state.profile.postcode]
    .filter(Boolean).join(', ');
}

// HTML-escape untrusted strings before interpolation into markup.
export function escH(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function statusOf(id) {
  const sub = state.submissions[id];
  if (!sub) return 'notstarted';
  return sub.status === 'completed' ? 'completed' : 'inprogress';
}

export function completedCount() {
  return FORMS.filter(f => statusOf(f.id) === 'completed').length;
}

export function allComplete() {
  return completedCount() === FORMS.length;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
