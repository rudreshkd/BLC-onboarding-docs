// forms.js — the 15-form registry (id, name, category, filename).
// SYNCED FROM portal/js/state.js FORMS/CATEGORIES/FILE_NAMES — keep in step (D4).
// Same domain data the candidate portal uses; the inspector groups by category.

export const CATEGORIES = [
  'Personal Details',
  'Pay & Tax',
  'Health',
  'Consents & Declarations',
  'Contract & Checks',
];

export const FORMS = [
  { id: 'application',     name: 'Application Form',                   category: 'Personal Details',          file: 'Application_Form.html' },
  { id: 'staffDetails',    name: 'Staff Details & Emergency Contacts', category: 'Personal Details',          file: 'Staff_Details_Emergency_Contacts.html' },
  { id: 'staffProfile',    name: 'Staff Profile',                      category: 'Personal Details',          file: 'Staff_Profile.html' },
  { id: 'bank',            name: 'Bank Details',                       category: 'Personal Details',          file: 'Bank_Details.html' },
  { id: 'hmrc',            name: 'HMRC Starter Checklist',             category: 'Pay & Tax',                 file: 'HMRC_Starter_Checklist.html' },
  { id: 'health',          name: 'Health Questionnaire',               category: 'Health',                    file: 'Health_Questionnaire.html' },
  { id: 'hepb',            name: 'Hepatitis B Vaccination Record',     category: 'Health',                    file: 'Hepatitis_B_Vaccination_Record.html' },
  { id: 'covid',           name: 'COVID-19 Vaccination Status',        category: 'Health',                    file: 'COVID19_Vaccination_Status.html' },
  { id: 'gdpr',            name: 'GDPR Consent',                       category: 'Consents & Declarations',   file: 'GDPR_Consent.html' },
  { id: 'confidentiality', name: 'Confidentiality Agreement',          category: 'Consents & Declarations',   file: 'Confidentiality_Agreement.html' },
  { id: 'criminal',        name: 'Criminal Record Self-Declaration',   category: 'Consents & Declarations',   file: 'Criminal_Record_Self_Declaration.html' },
  { id: 'wtd',             name: 'Working Time Opt-Out',               category: 'Consents & Declarations',   file: 'Working_Time_Opt_Out.html' },
  { id: 'offer',           name: 'Offer Letter & Contract',            category: 'Contract & Checks',         file: 'Offer_Letter_Contract.html' },
  { id: 'supervision',     name: 'Supervision Contract',               category: 'Contract & Checks',         file: 'Supervision_Contract.html' },
  { id: 'reg19',           name: 'Employment History (Regulation 19)', category: 'Contract & Checks',         file: 'Employment_History_Regulation_19.html' },
];
