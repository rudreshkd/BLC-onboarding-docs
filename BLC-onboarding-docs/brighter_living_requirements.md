# Brighter Living — Onboarding Portal: Requirements Document

**Company:** Brighter Living Care Ltd  
**Version:** 1.0 | June 2026  

---

## 1. Overview

Brighter Living Care Ltd requires a digital onboarding portal to replace its current paper-based process of emailing 15 separate forms to new candidates. The portal must allow candidates to complete, sign, and submit all required onboarding documents electronically before their start date, while giving HR full visibility of progress and access to completed form packs.

---

## 2. Problem Statement

The current process requires candidates to download, print, fill by hand, scan, and return 15 separate documents. This creates four key problems:

- Candidates re-enter the same personal information (name, address, NI, DOB) across nearly every form
- HR has no real-time visibility of which forms are outstanding
- Physical signatures and printed documents cause delays
- Some candidates never return all forms, causing compliance gaps for CQC-regulated onboarding

---

## 3. Users

| User | Description |
|---|---|
| **Candidate** | Newly offered employee. Receives a link, completes all forms, signs and submits electronically before their start date. |
| **HR / Recruiter** | Creates the candidate record and offer, monitors completion progress, receives completed pack, countersigns specific forms. |
| **Registered Manager / Director** | Countersigns compliance forms (Confidentiality Agreement, Regulation 19). |

---

## 4. Functional Requirements

### 4.1 Authentication

- Candidates must log in via a **magic link** sent to their email address — no password required.
- The magic link must expire after 15 minutes.
- A "resend link" option must be available on the check-email screen.
- Candidates must be able to sign out at any time, which clears their session.
- HR staff require a separate login (to be built).

### 4.2 Candidate Profile (Master Pre-fill)

- Candidates must complete a **single profile form** once, capturing:
  - Title, first name, last name
  - Date of birth, sex
  - National Insurance number
  - Address lines 1 & 2, city, county, postcode
  - Mobile number, home phone number, email address
- Profile data must **automatically pre-fill** the relevant fields on every subsequent form, so candidates never re-enter the same information.
- Pre-filled fields must be visually distinct (dashed border, tinted background) and read-only within each form.
- Candidates must be able to edit their profile at any time; changes must propagate to all forms immediately.

### 4.3 Dashboard

- After login, candidates land on a **dashboard** showing:
  - A personalised welcome message with their name
  - Their offer deadline (start date)
  - A progress indicator showing how many of 15 forms are complete
  - A list of all 15 forms with their current status
- Each form in the list must show:
  - Form name
  - Estimated completion time
  - Status badge: **Not started**, **In progress**, or **Completed**
  - Date submitted (if completed)
- Clicking any form row must open that form.
- A **Submit pack to HR** button must appear at the bottom. It must be disabled until all 15 forms are completed. When all are complete it must become active and visually prominent.
- If forms are outstanding, clicking the disabled button area must show a list of which forms are not yet complete.
- A **Download your forms** link must be accessible from the dashboard.

### 4.4 Form Completion

- All 15 forms must be completable entirely within the browser — no downloading or printing.
- Every form must display a **branded header** showing the Brighter Living logo, form name, and a back-to-dashboard button.
- Each form must have:
  - Pre-filled fields drawn from the candidate's profile
  - Form-specific fields unique to that document
  - Conditional fields that appear/hide based on earlier answers (e.g. Yes/No questions that reveal detail fields)
  - A signature block at the bottom (see 4.5)
  - A **Save & close** button that saves progress and returns to the dashboard without submitting
  - A **Done** button that submits the form (disabled until signature is valid)
- Once submitted, a form must be **locked** — all fields become read-only, and a confirmation banner shows the submission date and signed name.
- Returning to a completed form must show the locked read-only version.

### 4.5 E-Signature

- Every form must require the candidate to **type their full name** into a signature field before submission.
- The typed name must be rendered in a cursive/handwriting font.
- The Done button must remain disabled until at least 3 characters have been entered.
- On submission, the system must record: the typed name, the date of submission, and (in production) the candidate's IP address.
- Each form must capture a separate, independent signature — consents cannot be collapsed into a single signature.

### 4.6 The 15 Required Forms

The following forms must be included, digitised from the original Brighter Living Word/PDF documents:

| # | Form | Est. Time |
|---|---|---|
| 1 | Application Form | 20 min |
| 2 | Staff Details & Emergency Contacts | 5 min |
| 3 | Staff Profile | 3 min |
| 4 | Bank Details | 3 min |
| 5 | HMRC Starter Checklist | 5 min |
| 6 | Health Questionnaire | 10 min |
| 7 | Hepatitis B Vaccination Record | 2 min |
| 8 | COVID-19 Vaccination Status | 3 min |
| 9 | GDPR Consent | 5 min |
| 10 | Confidentiality Agreement | 2 min |
| 11 | Criminal Record Self-Declaration | 5 min |
| 12 | Working Time Opt-Out | 2 min |
| 13 | Offer Letter & Contract | 3 min |
| 14 | Supervision Contract | 3 min |
| 15 | Employment History (Regulation 19) | 15 min |

Each form must faithfully reproduce all fields, sections, and legal declaration wording from the original source documents.

### 4.7 Dynamic Employment History

- The Application Form and Regulation 19 form both require a variable number of employment entries.
- Candidates must be able to **add** entries using a "+ Add" button and **remove** entries using a "− Remove" button on each entry.
- Employment entries must include: employer name/address, contact details, dates (from/to), job title, and reason for leaving.
- Regulation 19 must also allow candidates to add and remove **gap entries**, explaining periods of non-employment.
- In locked (submitted) forms, add/remove buttons must not be shown.

### 4.8 Form Submission & Pack Submission

- Submitting an individual form marks it **Completed** on the dashboard — this is irreversible in the current build.
- The **Submit pack to HR** button must only activate when all 15 forms are marked Completed.
- Clicking Submit must show a confirmation modal: "Are you sure? This will send your pack to HR."
- The modal must have **Yes, submit** and **Go back** options.
- After confirming, a success screen must display confirming the pack has been sent to HR.

### 4.9 Downloads

- Candidates must be able to download their forms at any time from a dedicated **Downloads** section.
- Forms must be listed by category:
  - Personal Details (4 forms)
  - Pay & Tax (1 form)
  - Health (3 forms)
  - Consents & Declarations (4 forms)
  - Contract & Checks (3 forms)
- Each form must have an individual **Download** button producing a self-contained branded HTML file.
- Completed forms must show their submitted data and signature in the downloaded file.
- Incomplete forms must be downloadable as blank templates.
- Two bulk download options must be available:
  - **Download all files** — all 15 forms in a single flat ZIP folder
  - **Download folder structure** — same 15 files organised into the 5 category subfolders
- Both ZIPs must include a README.txt listing all files and their completion status.
- Download buttons must show a loading state ("Preparing ZIP…") while generating.

---

## 5. Form-Specific Requirements

### Application Form
Must include: personal details (pre-filled), essential eligibility questions (3 Yes/No), further questions including previous Brighter Living connection and other commitments, education history (3 entries), CPD/training (3 entries), employment status questions, dynamic full employment history (starts with 2 entries), gaps in employment textarea, 3 referee blocks (each with name/org/address/occupation/phone/email), additional questions (skills statement, sleep-in shifts, driving licence, COVID vaccination), and a GDPR talent pool declaration.

### Staff Details & Emergency Contacts
Must include: pre-filled personal details, two emergency contact blocks (first required, second optional), a medical conditions/medication textarea (confidential), and an any other comments textarea.

### Staff Profile
Must include: pre-filled name/DOB/telephone, role and start date (from offer data), leaving date field (blank for new starters), and a personal interests textarea.

### Bank Details
Must include: pre-filled name/DOB/NI/address, bank name, account number, sort code, and an optional comments field.

### HMRC Starter Checklist
Must replicate the official HMRC starter checklist exactly, including: pre-filled personal details, branching logic for Questions 8–10 to auto-select Statement A, B, or C, and conditional student loan plan selection (Plans 1, 2, 4, and Postgraduate).

### Health Questionnaire
Must include: pre-filled personal details (including sex and phone numbers), 17 Yes/No medical condition rows (each revealing a detail field on Yes), night duties question, sick days count, illness exceeding one week (with detail), and physical/mental impairment with adjustments field. Marked as strictly confidential / special category data.

### Hepatitis B
Must include: pre-filled name, vaccinated/not vaccinated choice, and conditional dose entry section (up to 3 doses with date and vaccine type).

### COVID-19 Vaccination
Must include: pre-filled name, yes/no vaccination question, conditional dose date fields (1st, 2nd, booster) and manufacturer dropdown if yes, and reason textarea if no.

### GDPR Consent
Must include: an 8-row consent table (data type, purpose, retention period, consent checkbox for each), a 5-agency data sharing permissions table, and a declaration with the candidate's name inserted.

### Confidentiality Agreement
Must include: the full confidentiality declaration with candidate name inserted, a single agreement checkbox, and a note that the manager will countersign separately.

### Criminal Record Self-Declaration
Must include: the declaration with candidate name, address, and DOB inserted, a binary no/yes convictions choice, and a conditional detail textarea for any declarations.

### Working Time Opt-Out
Must include: address to "The Manager, Brighter Living Care Ltd", the 48-hour limit declaration text, and a single agreement checkbox.

### Offer Letter & Contract
Must display the full offer letter with all contract terms populated from the offer data (role, start date, hours, salary), a confirmation acceptance checkbox, and a field for intended commencement date.

### Supervision Contract
Must display the full supervision policy (frequency, duration, location, recording, supervisee obligations), and a single acknowledgement checkbox.

### Employment History (Regulation 19)
Must include: pre-filled name, year of birth, and start date with Brighter Living; a school leaving date field; 8 dynamic employment entries (each with employer name/address, contact details, from/to month+year fields, role, reason for leaving); and 3 dynamic gap entries (from/to dates, reason). Required to satisfy CQC Regulation 19, Schedule 3.

---

## 6. Non-Functional Requirements

### 6.1 Accessibility
- All form fields must have properly associated labels.
- Keyboard navigation must work throughout (tab order, Enter to submit).
- Focus states must be clearly visible.
- Colour must not be the only means of conveying status.
- Target: WCAG 2.2 Level AA compliance.

### 6.2 Responsive Design
- The portal must be fully usable on mobile devices (minimum 360px viewport width).
- Multi-column layouts must stack to a single column on small screens.
- Tap targets must be at least 44px in height.

### 6.3 Performance
- The entire portal must load as a single file with no build step.
- No framework dependencies — vanilla HTML, CSS, and JavaScript only.
- Page load must not require a server (can run from `file://`).
- External dependencies: Google Fonts CDN and JSZip CDN only.

### 6.4 Security (Production)
- Magic links must use time-limited, single-use tokens (JWT or equivalent).
- All data must be transmitted over HTTPS.
- NI numbers and bank account details must be encrypted at rest.
- Session tokens must expire after inactivity.
- CSRF protection must be applied to all state-changing API endpoints.

### 6.5 Data & Compliance
- All candidate data must be stored on UK or EU servers.
- Data retention must be enforced: 6 months post-employment for most data; up to 7 years for HMRC-related data.
- The system must support data subject access requests (DSAR).
- An audit log must record all form submissions and data access events.
- A Data Protection Impact Assessment (DPIA) must be completed before production launch.
- The e-signature method must satisfy the UK Electronic Communications Act 2000 and UK eIDAS requirements.

---

## 7. Brand Requirements

- All screens must use the **Brighter Living** visual identity:
  - Primary colour: Purple `#6B35A3`
  - Dark header/nav colour: Dark purple `#1C1A2E`
  - Accent/border colour: Teal `#3DCFCF`
  - Gradient stripe (teal → purple → teal) at the top of every screen and form header
- The **Brighter Living logo mark** (circle head + dark purple left leaf + teal right leaf) must appear on:
  - The login page (full-colour, large)
  - The topbar (small, white version on dark background)
  - The dashboard welcome hero
  - Every form header
- Typography: **Poppins** for headings and labels; **Inter** for body text.
- All primary action buttons must use the brand purple with sufficient contrast for WCAG AA.

---

## 8. Out of Scope (Current Prototype)

The following are **not** included in the current build and are deferred to the production phase:

| Item | Notes |
|---|---|
| HR admin dashboard | Separate login, candidate list, progress view, countersignature workflow |
| Real email delivery | Magic links are currently simulated |
| Backend / database | No data is persisted between sessions |
| File uploads | Passport, DBS certificate, qualifications cannot be attached |
| Real document export | Downloads are HTML representations, not actual Word/PDF templates |
| Auto-save / draft persistence | Data is lost if the browser is closed or refreshed |
| Input validation | Only the signature field is currently validated |
| Multi-candidate support | Portal currently supports one simulated candidate |
| Automated reminders | No email chasing of incomplete forms |
| Manager countersignature | Required for Confidentiality and Reg 19 but not yet built |

---

## 9. Assumptions

- Brighter Living will provide updated offer details (role, salary, hours, start date) per candidate — currently hardcoded for prototyping.
- The e-signature (typed full name + timestamp + IP) is legally sufficient for these employment documents under UK law — legal sign-off recommended before production.
- Candidates will have access to a modern browser (Chrome 105+, Safari 15.4+, Firefox 121+) and a stable internet connection.
- HR will continue to use the existing personnel file system; the portal exports documents compatible with that system.

---

*Brighter Living Care Ltd — Onboarding Portal Requirements v1.0*
