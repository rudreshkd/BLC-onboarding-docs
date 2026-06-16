# Brighter Living — Production Build Task Breakdown

> Each task is self-contained. It includes all the context an AI coding tool needs to complete it
> without referring to other tasks or the wider spec. Tasks are ordered by build phase (spec §10).
> Dependency notes tell you which task(s) must be done first.

---

## PHASE 1 — Productionise the Candidate Portal

---

### TASK 1.1 — Modularise the portal into a multi-file project

**What to build**
Split the existing single-file `onboarding.html` (≈1,800 lines) into a clean folder structure:
```
portal/
  index.html
  css/
    tokens.css      ← CSS custom properties only (colours, fonts)
    layout.css      ← wrap, card, topbar, views
    forms.css       ← field, choice, sig-area, emp-block, etc.
    badges.css      ← status badges
  js/
    state.js        ← state object + helpers (fullName, fullAddr, escH, etc.)
    nav.js          ← showView, goToDashboard, signOut
    dashboard.js    ← renderDashboard, badgeHTML, statusOf
    forms.js        ← openForm, submitForm, FORM_BODIES object
    entries.js      ← empEntryBlock, gapEntryBlock, addEntry, removeEntry
    signature.js    ← sig validation, submitForm logic
    downloads.js    ← showDownloads, renderDownloads, downloadSingle,
                       downloadAllFlat, downloadFoldered, buildZip,
                       generateFormHTML, triggerDownload
    auth.js         ← sendMagicLink, completeLogin, signOut
    toast.js        ← showToast
```

**Rules**
- No framework, no build step. Each JS file uses ES module syntax (`export`/`import`).
- `index.html` loads modules via `<script type="module" src="js/state.js">` etc.
- All CSS custom properties live only in `tokens.css`; all other files use `var(--token-name)`.
- The brand colour tokens to preserve exactly:

| Variable | Hex | Use |
|---|---|---|
| `--green` | `#6B35A3` | Primary CTA buttons, active borders, progress fill |
| `--green-dk` | `#1C1A2E` | Topbar, form headers, footer backgrounds |
| `--green-md` | `#3D1A6B` | Deep purple text accents |
| `--green-lt` | `#F0EBF9` | Section backgrounds, info boxes |
| `--gold` | `#3DCFCF` | Teal — section borders, accent stripe |
| `--gold-lt` | `#E0F7F7` | Declaration box backgrounds |
| `--gold-dk` | `#4A2070` | Button hover states |
| `--amber` | `#C97B0A` | In-progress badges |
| `--red` | `#dc2626` | Errors, required markers |
| `--bg` | `#F6F3FC` | Page background |
| `--border` | `#DCD5ED` | Field borders |
| `--text` | `#111827` | Body text |
| `--muted` | `#5C4E72` | Labels |

- The brand gradient stripe: `linear-gradient(90deg, #3DCFCF 0%, #6B35A3 55%, #3DCFCF 100%)`
- Fonts: Poppins (headings/labels) + Inter (body), loaded via Google Fonts `<link>` in `index.html`.
- JSZip 3.10.1 loaded via `<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js">`.
- All existing functionality must work identically after the split.

**Acceptance criteria**
- Opening `portal/index.html` in a browser produces an identical UI and flow to the original file.
- No inline `<style>` or `<script>` blocks remain in `index.html`.
- Each JS module imports only what it uses.

**Dependencies:** none — this is the starting task.

---

### TASK 1.2 — Implement `collectFormData(id)`

**What to build**
A function `collectFormData(id)` in `js/forms.js` that, when called before a form is submitted,
reads every field value from the currently rendered form DOM and returns a structured object.

**Context**
The existing prototype sets `state.submissions[id].data = {}` always — it records the signature
but none of the actual field values. This task closes that gap so the downloaded pack contains
real answers.

**Function signature**
```javascript
// Returns a plain object of field values for the given form id.
// Called by submitForm(id) just before recording the submission.
export function collectFormData(id) { ... }
```

**What to collect per field type**
- `<input type="text|email|tel|number|date|month">` → `{ [fieldId]: inputEl.value.trim() }`
- `<select>` → `{ [fieldId]: selectEl.value }`
- `<textarea>` → `{ [fieldId]: textarea.value.trim() }`
- `<input type="radio">` → `{ [name]: checkedRadio.value }` (one entry per radio group name)
- `<input type="checkbox">` → `{ [id]: checkbox.checked }` (boolean)
- Repeater rows (`.emp-block`): collect as an array of objects, one per row.
  Each row → `{ employer, role, from, to, reason }` read from the inputs within that `.emp-block`.
- Gap rows: collect as an array `{ fromMM, fromYYYY, toMM, toYYYY, reason }`.

**Integration point**
In `submitForm(id)` (already exists in `js/signature.js`), replace the line:
```javascript
state.submissions[id].data = {}
```
with:
```javascript
state.submissions[id].data = collectFormData(id)
```

**Acceptance criteria**
- After signing and submitting the Bank Details form, `state.submissions['bank'].data` contains
  `{ bankName, accountNumber, sortCode }` with the values the candidate typed.
- After submitting the Application Form, `state.submissions['application'].data.employmentHistory`
  is an array with one object per row the candidate added.
- Pre-filled read-only fields are included in the output (their values are still readable from the DOM).

**Dependencies:** TASK 1.1

---

### TASK 1.3 — Input validation: required fields and format checks

**What to build**
A `validateForm(id)` function in a new file `js/validation.js` that runs before a form can be
signed. If validation fails, it highlights the offending fields and blocks the signature block
from showing.

**Validation rules to enforce**

| Field | Rule |
|---|---|
| Any field with a `*` label (`.req` class) | Must not be empty |
| NI number (`#ni`) | Must match `/^[A-Z]{2}\d{6}[A-Z]$/i` after stripping spaces |
| Sort code (`#sortCode`) | Must match `/^\d{2}-\d{2}-\d{2}$/` or 6 bare digits |
| Account number (`#accountNumber`) | Must be exactly 8 digits |
| Email fields (`type="email"`) | Standard email regex |
| Postcode (`#postcode`) | Must match `/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i` |
| MM/YYYY month inputs | Must match `/^(0[1-9]|1[0-2])\/\d{4}$/` |
| Date inputs (`type="date"`) | Must not be empty if required |

**Error display**
- Add class `field-error` to the `.field` wrapper of any failing input.
- Insert a `<p class="error-msg">` beneath the input with a short human message
  (e.g. "Enter a valid NI number — two letters, six digits, one letter").
- Scroll to the first error.
- Remove errors on the next `input` or `change` event on that field.

**CSS to add in `forms.css`**
```css
.field-error input,
.field-error select,
.field-error textarea { border-color: var(--red); background: var(--red-lt, #fee2e2); }
.error-msg { color: var(--red); font-size: 12px; margin-top: 4px; }
```

**Integration**
In `js/forms.js`, call `validateForm(id)` when the candidate first clicks into the signature
input. If `validateForm` returns `false`, keep the signature block hidden and show errors.

**Acceptance criteria**
- Submitting Bank Details with a 7-digit account number shows an inline error and prevents signing.
- Fixing the account number clears the error immediately.
- A valid NI number `QQ123456C` passes; `QQ 12 34 56 C` (with spaces) also passes after stripping.
- All 15 forms run through `validateForm` without errors when filled correctly.

**Dependencies:** TASK 1.1

---

### TASK 1.4 — Encrypted local draft (IndexedDB)

**What to build**
Auto-save the candidate's in-progress form answers to IndexedDB, encrypted with a session key
that never leaves the browser. Restore the draft on page load if it exists.

**Context**
Currently, refreshing the page loses all data. This task adds resilience for candidates who
close the tab mid-journey. The draft is an optional quality-of-life feature; it must not send
any data to a server.

**New file: `js/draft.js`**

```javascript
// draft.js — encrypted local draft using Web Crypto API

const DB_NAME   = 'bl-draft';
const STORE     = 'session';
const KEY_STORE = 'bl-draft-key';

// Generate or retrieve a session AES-GCM key held in sessionStorage
async function getKey() { ... }

// Encrypt JSON string → base64 ciphertext
async function encrypt(plaintext) { ... }

// Decrypt base64 ciphertext → JSON string
async function decrypt(ciphertext) { ... }

// Save state object to IndexedDB (encrypted)
export async function saveDraft(stateObj) { ... }

// Load and decrypt draft; returns parsed state object or null
export async function loadDraft() { ... }

// Hard-delete the draft (called on successful pack submission)
export async function clearDraft() { ... }
```

**Encryption spec**
- Algorithm: AES-GCM, 256-bit key.
- Key stored in `sessionStorage` as a base64-exported raw key — survives page refresh within
  the same browser session but is gone when the tab is closed.
- Each `saveDraft` call generates a fresh 96-bit IV; store it alongside the ciphertext.
- Store format in IndexedDB: `{ id: 'draft', iv: '<base64>', ciphertext: '<base64>' }`.

**Auto-save trigger**
In `js/dashboard.js` / `js/forms.js`, call `saveDraft(state)` on:
- Every profile save (`saveDetails`).
- Every form submission (`submitForm`).
- Before navigating away from a form (`goToDashboard`).

**Restore on load**
In `js/auth.js` → `completeLogin()`, after setting up state call:
```javascript
const draft = await loadDraft();
if (draft) Object.assign(state, draft);
```

**Clear on final submit**
In the final pack-submission flow (TASK 2.3), call `clearDraft()` after the pack has been
successfully uploaded.

**Acceptance criteria**
- Filling in the profile, refreshing the page, and clicking the magic-link button again
  restores the profile fields.
- `state.submissions` is restored correctly (completed forms remain completed).
- Inspecting IndexedDB in DevTools shows only a ciphertext blob, never plaintext JSON.
- `clearDraft()` removes the record entirely.

**Dependencies:** TASK 1.1

---

### TASK 1.5 — `generateFormHTML(id)` with real field values

**What to build**
Update the existing `generateFormHTML(id)` function in `js/downloads.js` so that each
downloaded form file contains the candidate's actual answers, not placeholder text.

**Context**
The prototype's `generateFormHTML` already produces a self-contained HTML document with a
branded header, candidate details panel, status block, and a prototype-note box. This task
replaces the placeholder body with the real captured data from `state.submissions[id].data`
(populated by TASK 1.2).

**Structure of the generated file (unchanged)**
1. Teal-to-purple gradient stripe (6px).
2. Dark header: Brighter Living logo mark + wordmark + "Onboarding" badge + doc reference.
3. White title band: form name as `<h1>`.
4. Status block: green "✓ Submitted on [date] · Signed by [name]" or amber "⏳ Not yet submitted".
5. Candidate details grid: name, DOB, NI, mobile, email, address — from `state.profile`.
6. **Form answers section (new):** render `state.submissions[id].data` as a readable table or
   definition list. Group fields by the same sections used in the form itself.
   - Simple fields: two-column table, label | value.
   - Array fields (employment history, gap entries): one sub-table per entry.
   - Boolean fields (checkboxes): show "Yes" / "No".
   - Empty optional fields: show "—".
7. Signature record: signed name in Brush Script cursive, timestamp.
8. Dark footer: company name + address, document reference.

**Remove**
The "Prototype note" box (blue tint) that currently says this is a prototype — replace it
with the real data section described above.

**File remains**
- Fully self-contained (inline CSS, no external assets except Google Fonts `@import`).
- No interactive elements.
- Named per `FILE_NAMES[id]` lookup, e.g. `Bank_Details.html`.

**Acceptance criteria**
- Completing and downloading Bank Details produces an HTML file that shows the bank name,
  account number (last 4 digits only — mask the rest with ••••), and sort code.
- Completing and downloading the Application Form shows the employment history entries in
  a readable sub-table.
- All 15 form downloads contain real field data after the forms are completed.

**Dependencies:** TASK 1.2

---

### TASK 1.6 — Wire form progress reporting to the backend API

**What to build**
After each form is signed and submitted in the candidate portal, report the new status
to the backend so the HR Dashboard reflects live progress.

**Context**
The existing `submitForm(id)` in `js/signature.js` updates `state.submissions[id]` locally.
This task adds a non-blocking API call to PATCH `/invites/:id/progress` so HR can see
real-time form completion without waiting for the full pack upload.

**What to add in `js/signature.js`**

```javascript
// After updating state.submissions[id], fire-and-forget the progress update.
// Failures are swallowed — this is telemetry, not critical path.
async function reportProgress(formId, status) {
  if (!state.session?.inviteId) return;   // not yet authenticated against backend
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
```

Call `reportProgress(id, 'completed')` at the end of `submitForm(id)`, after
`state.submissions[id]` is set.

Also call `reportProgress(id, 'in_progress')` at the start of `openForm(id)`, when the
status is first set to `in_progress`.

**When not authenticated**
If `state.session` is not set (candidate opened the portal via the prototype flow rather
than a real magic link), `reportProgress` returns immediately without calling the API.
The portal continues to work standalone — the API call is additive.

**Acceptance criteria**
- Completing the Bank Details form triggers a PATCH to `/invites/{id}/progress` with body
  `{ "formId": "bank", "status": "completed" }`.
- The HR Dashboard GET `/invites` response shows `formsComplete` incrementing as the
  candidate completes each form.
- If the network call fails (e.g. 500 from the server), the form is still recorded as
  completed locally and the candidate is not shown an error.

**Dependencies:** TASK 1.1, TASK 3.4.

---

## PHASE 2 — Pack Build + Relay Upload

> **Architecture decision (2026-06-16):** Phase 2 originally planned client-side zero-knowledge
> encryption (RSA-OAEP envelope encryption in the browser, private key custodied by HR).
> This was reversed before landing. Non-technical care-home HR cannot safely custody a private
> key file — losing it loses every pack; mishandling it silently breaks confidentiality.
> GDPR/CQC do not require zero-knowledge. Server-side KMS gives key recovery, rotation, IAM,
> and audit, and HR never touches a key.
>
> **TASKs 2.1 and 2.2 are removed.** `hr-keygen.html` and `js/crypto.js` were built, verified,
> and then deleted. TASK 2.3 is simplified. TASK 2.4 becomes a server-side authenticated
> download (no client-side decryption). Server encryption is specified in TASK 3.3.

---

### ~~TASK 2.1 — HR key pair generation utility~~ *(removed)*

Superseded by server-side KMS. `hr-keygen.html` has been deleted from the repository.

---

### ~~TASK 2.2 — Client-side pack encryption module~~ *(removed)*

Superseded by server-side KMS. `js/crypto.js` has been deleted from the repository.

---

### TASK 2.3 — Pack build and upload on final submit ✅ *complete*

**What was built**
`js/submit.js` — wires pack building and relay upload so that clicking "Submit pack to HR"
on the dashboard triggers the full sequence. The browser sends a plain ZIP over HTTPS;
the server (TASK 3.3) encrypts it at rest with a KMS-managed key.

**Implemented sequence**

```javascript
export async function submitPackToHR() {
  if (navigator.onLine === false) return { status: 'offline' };

  const zipBlob = await buildZip(true); // foldered structure
  const inviteId = state.session?.inviteId;

  let res;
  try {
    res = await fetch(`/packs/${inviteId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
        'Authorization': `Bearer ${state.session?.token}`,
      },
      body: zipBlob,
    });
  } catch {
    return { status: 'no-backend' }; // network/route absent — relay not deployed
  }

  if (res.status === 404 || res.status === 405 || res.status === 501) {
    return { status: 'no-backend' }; // static host, relay not deployed yet
  }
  if (!res.ok) throw new Error('Upload failed');
  return { status: 'uploaded' };
}
```

**Offline fallback**
Returns `{ status: 'offline' }` immediately. `dashboard.js` shows an offline modal and
re-attempts automatically on the `online` event.

**No-backend fallback**
Returns `{ status: 'no-backend' }` when the relay is absent (404/405/501 or network error).
The candidate journey completes locally and the draft is preserved. The upload lights up
automatically once Phase 3 deploys — no client changes required.

**Acceptance criteria**
- Completing all 15 forms and clicking submit causes a PUT request to `/packs/{id}` with
  `Content-Type: application/zip` and the ZIP blob as the body.
- The request includes the `Authorization` header with the session token.
- On a simulated 500 response, the success screen does not show and the draft is preserved.
- On a simulated offline state, the offline modal appears and auto-retries on reconnect.

**Dependencies:** TASK 1.2, TASK 1.5, TASK 1.6, TASK 3.2, TASK 3.4.

---

### TASK 2.4 — HR Dashboard: authenticated pack download

**What to build**
The download flow in the HR Dashboard SPA (`hr-dashboard/js/download.js`) that lets HR
download a candidate's pack via an authenticated GET to the relay. The server decrypts
the pack before streaming it — HR never handles a key file.

**Context**
The HR Dashboard (TASK 4.1 shell) displays a candidate row. When HR clicks "Download Pack",
this module fires a credentialed GET, receives the plaintext ZIP bytes, and saves the file.
No private-key file picker, no client-side decryption.

**New file: `hr-dashboard/js/download.js`**

```javascript
// Full flow triggered by "Download Pack" button:
//   1. GET /packs/{id} with HR JWT (server decrypts and streams the ZIP)
//   2. Receive response as ArrayBuffer
//   3. Trigger browser download of the resulting ZIP as
//      Brighter_Living_{candidateName}_Onboarding_Pack.zip
export async function downloadPack(inviteId, candidateName) {
  const res = await fetch(`/packs/${inviteId}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.hrToken}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Brighter_Living_${candidateName}_Onboarding_Pack.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Acceptance criteria**
- Clicking "Download Pack" with a valid HR JWT fetches `/packs/{id}` and saves a ZIP.
- The downloaded ZIP opens correctly and contains the five category subfolders plus the
  manifest README.
- If the JWT is missing or expired, an error toast is shown and no download occurs.
- The GET request is logged in the backend audit log (TASK 3.3).

**Dependencies:** TASK 2.3, TASK 3.3, TASK 4.1.

> **Note on ordering:** This module can be built and tested in isolation once TASK 3.3 provides
> the GET `/packs/:id` endpoint. It is wired into the dashboard UI in TASK 4.2.

---

## PHASE 3 — Invite & Identity Service ✅ *complete*

> **Built (2026-06-16):** Node.js 22 + Fastify service under `backend/`. Build decisions from
> the engineering review: **(D1)** Homebrew Postgres locally + a portable `pg`-based migration
> runner (not `psql`) + managed Postgres in prod via `DATABASE_URL`; **(D2)** storage/KMS behind
> adapter interfaces with local-only impls (filesystem + local AES key-wrapping), concrete AWS
> S3/KMS deferred to deploy; **(D3)** `POST /hr/auth/login` pulled forward from TASK 4.1 (the
> HR-gated endpoints need an HR JWT); **(D4)** minimal `portal/js/auth.js` wiring so the portal
> reads `?token=` on page load, verifies, and sets `state.session`. 38 tests pass
> (`npm test`, serialized). See `backend/README.md`.

---

### TASK 3.1 — Database schema and migrations ✅

**What to build**
PostgreSQL schema for the Invite & Identity Service. Two tables only — no form-answer columns.

**Table: `invites`**

```sql
CREATE TABLE invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  role          TEXT NOT NULL,
  offer_terms   JSONB NOT NULL,
  -- offer_terms shape: { startDate, salary, hours, manager }
  status        TEXT NOT NULL DEFAULT 'invited',
  -- 'invited' | 'in_progress' | 'submitted' | 'received'
  form_progress JSONB NOT NULL DEFAULT '{}',
  -- shape: { "bank": "completed", "application": "in_progress", ... }
  -- updated by candidate portal on each form sign
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Table: `magic_link_tokens`**

```sql
CREATE TABLE magic_link_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id   UUID NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  -- store SHA-256 hash of the token, never the raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  -- null = not yet used; non-null = consumed (single use)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON magic_link_tokens(token_hash);
```

**Table: `audit_log`**

```sql
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  invite_id   UUID REFERENCES invites(id) ON DELETE SET NULL,
  event       TEXT NOT NULL,
  -- 'invite_created' | 'link_sent' | 'link_verified' | 'form_progress_updated'
  -- | 'pack_submitted' | 'pack_downloaded' | 'pack_received' | 'pack_purged'
  actor       TEXT,
  -- 'candidate' | 'hr:{user_id}' | 'system'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Migration runner**
Use plain SQL files in a `migrations/` folder, applied in order by filename:
`001_create_invites.sql`, `002_create_tokens.sql`, `003_create_audit_log.sql`.
Run with: `psql $DATABASE_URL -f migrations/001_create_invites.sql` etc.

**Acceptance criteria**
- All three `CREATE TABLE` statements execute without error on a fresh PostgreSQL 15+ database.
- `invites.form_progress` accepts `{}` and `{"bank":"completed","application":"in_progress"}`.
- Inserting a token, using it (setting `used_at`), and attempting a second use is detectable
  by checking `WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`.

**Dependencies:** none.

---

### TASK 3.2 — Magic-link API: issue and verify endpoints ✅

**What to build**
Two HTTP endpoints in Node.js (Fastify) or Python (FastAPI):

**POST `/auth/invite-link`** — internal endpoint, called by the HR Dashboard to issue a link.

Request body:
```json
{ "inviteId": "uuid" }
```

Logic:
1. Verify the invite exists and status is `'invited'`.
2. Generate a cryptographically random 32-byte token (`crypto.randomBytes(32).toString('hex')`).
3. Hash it with SHA-256; store the hash in `magic_link_tokens` with `expires_at = NOW() + interval '7 days'`.
4. Return `{ "link": "https://onboarding.brighterliving.co.uk/?token=<raw_token>" }`.
   (The Notification Service, TASK 5.1, emails this link — this endpoint just issues it.)

**POST `/auth/verify`** — public endpoint, hit by the candidate portal on page load if `?token=` is in the URL.

Request body:
```json
{ "token": "<raw_token_from_url>" }
```

Logic:
1. Hash the incoming token.
2. Look up `magic_link_tokens` where `token_hash = hash AND used_at IS NULL AND expires_at > NOW()`.
3. If not found: return 401 `{ "error": "Link expired or already used" }`.
4. If found: mark `used_at = NOW()`. Fetch the linked `invite`. Create a short-lived JWT session
   token (e.g. 8-hour expiry) signed with `process.env.JWT_SECRET`.
   JWT payload: `{ sub: inviteId, email, role }`.
5. Return:
```json
{
  "sessionToken": "<jwt>",
  "inviteId": "<uuid>",
  "offerTerms": { "role": "...", "startDate": "...", "salary": "...", "hours": "...", "manager": "..." }
}
```
6. Write `invite_created` / `link_verified` to `audit_log`.

**The candidate portal** stores `sessionToken` and `inviteId` on `state.session` (used by TASK 2.3).

**Acceptance criteria**
- A fresh token verifies successfully and returns offer terms.
- The same token used a second time returns 401.
- A token verified after `expires_at` returns 401.
- JWT can be decoded with the same `JWT_SECRET` to confirm `sub` matches `inviteId`.

**Dependencies:** TASK 3.1.

---

### TASK 3.3 — Relay upload/download endpoints with KMS encryption at rest ✅

**What to build**
Two endpoints extending the same service from TASK 3.2. The server handles all encryption;
no `/keys/hr-public` endpoint is needed (client sends a plain ZIP).

**PUT `/packs/:inviteId`** — receives the candidate's ZIP and encrypts it at rest.

- Require `Authorization: Bearer <jwt>` header; verify JWT; confirm `sub === inviteId`.
- Enforce `Content-Type: application/zip`.
- Enforce max body size of 50 MB (reject with 413 otherwise).
- KMS encrypt the body:
  1. Call KMS `GenerateDataKey` (AES-256).
  2. AES-GCM encrypt the ZIP with the plaintext data key (random 96-bit IV).
  3. Store `{ ciphertext, wrappedDataKey, iv }` in object storage (S3 / Azure Blob / R2)
     at key `packs/{inviteId}`. Set object TTL = 14 days via storage-provider expiry
     (application-level deletion happens via TASK 3.4 POST `/packs/:id/receipt`).
- Update `invites.status = 'submitted'` and `updated_at = NOW()`.
- Write `pack_submitted` to `audit_log`.
- Trigger pack-ready email (TASK 5.2) asynchronously — stub as a no-op until TASK 5.2 lands.
- Return 204 No Content.

**GET `/packs/:inviteId`** — decrypts and streams the ZIP to HR.

- Require HR authentication (JWT with `role: 'hr'` — issued by TASK 4.1).
- Fetch the encrypted object from storage. If not found (already purged): return 404.
- KMS decrypt:
  1. Call KMS `Decrypt` on the `wrappedDataKey`.
  2. AES-GCM decrypt the ciphertext with the recovered data key and stored IV.
- Stream the plaintext ZIP with `Content-Type: application/zip`.
- Write `pack_downloaded` to `audit_log`.

**Environment variables required**
```
DATABASE_URL=postgres://...
JWT_SECRET=...
KMS_KEY_ID=...           # ARN or key alias for the KMS CMK
STORAGE_BUCKET=...
STORAGE_REGION=...
AWS_ACCESS_KEY_ID=...    # or equivalent for chosen provider
AWS_SECRET_ACCESS_KEY=...
```

**IAM / KMS policy**
- The service role needs `kms:GenerateDataKey` + `kms:Decrypt` on the CMK only.
- No HR user or service ever holds the CMK directly — KMS manages it.

**Acceptance criteria**
- PUT `/packs/{id}` with a valid candidate JWT and a ZIP body returns 204; the object in
  the bucket contains ciphertext (not the raw ZIP bytes).
- GET `/packs/{id}` with a valid HR JWT returns the original ZIP bytes (round-trip check).
- GET `/packs/{id}` without an HR JWT returns 401.
- GET `/packs/{id}` after the object is deleted returns 404.
- PUT `/packs/{id}` with `Content-Type: application/json` returns 415.

**Dependencies:** TASK 3.1, TASK 3.2.

---

### TASK 3.4 — Invite CRUD endpoints (for HR Dashboard) ✅

**What to build**
The remaining API surface used by the HR Admin Dashboard.

**POST `/invites`** — HR creates a candidate invite.

Request (HR JWT required):
```json
{
  "email": "candidate@example.com",
  "role": "Support Worker",
  "offerTerms": {
    "startDate": "TBC",
    "salary": "£12.71/hr",
    "hours": "35 hours per week",
    "manager": "Josiah Millar"
  }
}
```

Logic:
1. Insert into `invites` with `status = 'invited'`, `form_progress = {}`.
2. Write `invite_created` to `audit_log`.
3. Call the Notification Service (TASK 5.1) to send the magic-link email asynchronously.
   **Stub this call for now:** `await notifyMagicLink(inviteId)` — implement as a no-op
   function `async function notifyMagicLink(id) {}` in a `notifications/stub.js` file.
   TASK 5.1 will replace this stub with the real email send.
4. Return `{ "inviteId": "<uuid>" }` with 201.

**GET `/invites`** — HR lists all active invites.

Response (HR JWT required):
```json
[
  {
    "id": "uuid",
    "email": "...",
    "role": "...",
    "status": "in_progress",
    "formProgress": { "bank": "completed", "application": "in_progress" },
    "formsComplete": 3,
    "formsTotal": 15,
    "submittedAt": null,
    "createdAt": "..."
  }
]
```

`formsComplete` is computed as the count of keys in `form_progress` where value = `'completed'`.

**PATCH `/invites/:id/progress`** — candidate portal updates form progress.

Request (candidate JWT required):
```json
{ "formId": "bank", "status": "completed" }
```

Logic:
1. Verify JWT `sub === id`.
2. Update `invites.form_progress = form_progress || '{}'::jsonb || jsonb_build_object($formId, $status)`.
3. If all 15 forms are completed, set `invites.status = 'submitted'` (gateway check before
   TASK 2.3 upload is attempted — belt-and-braces).
4. Write `form_progress_updated` to `audit_log`.
5. Return 204.

**POST `/invites/:id/remind`** — HR resends magic link.

- Check status is `'invited'` or `'in_progress'`.
- Issue a new token (reuse logic from TASK 3.2 POST `/auth/invite-link`).
- Trigger Notification Service.
- Return 204.

**POST `/packs/:id/receipt`** — HR confirms receipt; triggers purge.

- HR JWT required.
- Delete the object from storage: `storage.deleteObject('packs/{id}')`.
- Update `invites.status = 'received'`.
- Write `pack_received` and `pack_purged` to `audit_log`.
- Return 204.

**Acceptance criteria**
- POST `/invites` returns a UUID and the invite appears in GET `/invites`.
- PATCH `/invites/:id/progress` with `{ formId: 'bank', status: 'completed' }` increments
  `formsComplete` by 1 in the GET response.
- POST `/packs/:id/receipt` deletes the object from storage (verify via SDK `headObject` → 404).

**Dependencies:** TASK 3.1, TASK 3.2, TASK 3.3.

---

### TASK 3.5 — Scheduled metadata purge job ✅

**What to build**
A cron job (or scheduled function) that purges stale invite metadata from the `invites` and
`magic_link_tokens` tables on a nightly schedule.

**Context**
Spec §4.1 states invite metadata is held "until onboarding closed, then purged on a scheduled
job". This task implements that job. It runs separately from the API service — as a standalone
script, a cron job on the server, or a scheduled function (e.g. AWS EventBridge, Vercel Cron).

**What to purge**

| Condition | Action |
|---|---|
| `invites.status = 'received'` AND `updated_at < NOW() - interval '30 days'` | Delete the invite row (cascades to tokens and audit_log via FK ON DELETE SET NULL / CASCADE) |
| `magic_link_tokens.expires_at < NOW() - interval '30 days'` | Delete expired token rows not already removed by cascade |

**Script: `scripts/purge-old-invites.js`**

```javascript
// Run via: node scripts/purge-old-invites.js
// Or schedule with cron: 0 2 * * * node /app/scripts/purge-old-invites.js

import { pool } from '../src/db.js';

async function purge() {
  // 1. Delete received invites older than 30 days
  const { rowCount: invitesDeleted } = await pool.query(`
    DELETE FROM invites
    WHERE status = 'received'
    AND updated_at < NOW() - INTERVAL '30 days'
  `);

  // 2. Delete orphaned expired tokens
  const { rowCount: tokensDeleted } = await pool.query(`
    DELETE FROM magic_link_tokens
    WHERE expires_at < NOW() - INTERVAL '30 days'
    AND invite_id NOT IN (SELECT id FROM invites)
  `);

  // 3. Write to audit_log
  await pool.query(`
    INSERT INTO audit_log (event, actor)
    VALUES ('scheduled_purge', 'system')
  `);

  console.log(`Purged ${invitesDeleted} invites, ${tokensDeleted} orphaned tokens`);
  await pool.end();
}

purge().catch(err => { console.error(err); process.exit(1); });
```

**Schedule**
Run nightly at 02:00 UTC. Configure via whichever scheduler is available in the deployment
environment. The script is idempotent — running it multiple times produces the same result.

**Environment variables**
Same `DATABASE_URL` as the main API service.

**Acceptance criteria**
- Running the script on a DB with a 35-day-old `received` invite removes that invite row
  and its associated tokens.
- Running the script on a DB with no eligible rows completes without error (0 rows deleted).
- An `audit_log` row with event `scheduled_purge` is written on every run.
- Running the script twice in a row does not double-delete or error.

**Dependencies:** TASK 3.1, TASK 3.4.

---

## PHASE 4 — HR Admin Dashboard SPA

---

### TASK 4.1 — HR Dashboard shell, login, and metrics layer

**What to build**
The `hr-dashboard/index.html` single-page application shell, HR login, and the three-metric
summary header band. This is a separate SPA from the candidate portal.

**File structure**
```
hr-dashboard/
  index.html
  css/
    tokens.css    ← same brand tokens as the candidate portal (copy from TASK 1.1)
    hr.css        ← dashboard-specific styles
  js/
    auth.js       ← HR login / session
    api.js        ← thin fetch wrapper (all calls to the backend)
    dashboard.js  ← render metrics, render table, event handlers
    toast.js      ← showToast (copy from candidate portal)
```

**Login screen**
- Email + password fields (HR uses a password, unlike candidates who use magic links).
- On submit: POST `/hr/auth/login` → receives a JWT with `{ role: 'hr' }`.
- Store JWT in `sessionStorage.hrToken`.
- On success: show dashboard view.

**POST `/hr/auth/login`** — add to the **same backend service built in Tasks 3.2–3.4** (not a new service):
- Accept `{ email, password }`.
- For now: validate against a hardcoded env var `HR_EMAIL` / `HR_PASSWORD_HASH` (bcrypt).
- Return `{ "token": "<jwt with role:hr, sub: hr_user_id>" }`.

**Metrics header band** — three cards computed from GET `/invites` response:

| Card | Value |
|---|---|
| Total Onboarding Candidates | `invites.length` |
| Pending HR Reviews | `invites.filter(i => i.status === 'submitted').length` |
| Fully Received | `invites.filter(i => i.status === 'received').length` |

Cards use `--green` (purple) background with white text, Poppins 700 for the number.

**Polling**
Re-fetch `/invites` every 30 seconds and re-render the metrics and table silently.

**Acceptance criteria**
- Logging in with correct credentials shows the dashboard; wrong credentials shows an error.
- The three metric cards update when the underlying invite data changes.
- The JWT in `sessionStorage` is cleared on sign-out.

**Dependencies:** TASK 3.4.

---

### TASK 4.2 — Submission tracking matrix

**What to build**
The main candidate grid in the HR Dashboard, rendered from the GET `/invites` API response.

**Table columns**

| Column | Source | Notes |
|---|---|---|
| Candidate name | `invite.email` split at `@`, capitalised | Full name not held — only email |
| Target care role | `invite.role` | e.g. Support Worker |
| Submitted | `invite.submittedAt` formatted `DD Mon YYYY HH:MM` | "—" if not yet submitted |
| Progress | `{formsComplete} / 15` with a mini progress bar | Bar fill = `formsComplete / 15 * 100%` |
| Status badge | `invite.status` | Invited (gray) / In progress (amber) / Submitted (purple) / Received (green) |
| Actions | Button(s) | See below |

**Action buttons per row**

| Status | Button(s) shown |
|---|---|
| `invited` | "Resend link" |
| `in_progress` | "Resend link" |
| `submitted` | "Download Pack" (primary), "Resend link" (secondary) |
| `received` | "View record" only (pack already purged) |

- "Resend link" → POST `/invites/{id}/remind` → toast "Reminder sent to {email}".
- "Download Pack" → triggers TASK 2.4 `downloadPack(inviteId, candidateName)`. The server
  decrypts and streams the ZIP; no private-key file picker is shown to HR.
- After the download completes, show "Confirm Receipt" button in the row.
- "Confirm Receipt" → POST `/packs/{id}/receipt` → row status updates to `received` → toast
  "Pack received and purged from relay".

**Acceptance criteria**
- The table renders all invites returned by GET `/invites`.
- Clicking "Resend link" fires the API call and shows a toast.
- After "Download & Decrypt" succeeds, "Confirm Receipt" appears in the same row without
  a page refresh.
- After "Confirm Receipt", the row status badge updates to "Received" without a page refresh.

**Dependencies:** TASK 4.1, TASK 2.4, TASK 3.4.

---

### TASK 4.3 — Expanded candidate record inspector

**What to build**
A slide-in panel (or modal) that opens when HR clicks "View record" on any row in the
tracking matrix. Shows the per-form status breakdown from `invite.formProgress`.

**Panel contents**

```
[← Back]   Sarah Okonkwo — Support Worker   [Status badge]

Progress: 15 / 15 forms complete  [============================]

─── Personal Details ──────────────────────────────────────
  ✓  Application Form          Signed 22 May 2026  [Download]
  ✓  Staff Details             Signed 22 May 2026  [Download]
  ✓  Staff Profile             Signed 22 May 2026  [Download]
  ✓  Bank Details              Signed 22 May 2026  [Download]

─── Pay & Tax ──────────────────────────────────────────────
  ✓  HMRC Starter Checklist    Signed 22 May 2026  [Download]

─── Health ─────────────────────────────────────────────────
  ✓  Health Questionnaire      Signed 22 May 2026  [Download]
  ✓  Hepatitis B               Signed 22 May 2026  [Download]
  ✓  COVID-19 Vaccination      Signed 22 May 2026  [Download]

─── Consents & Declarations ────────────────────────────────
  ✓  GDPR Consent              Signed 22 May 2026  [Download]
  ✓  Confidentiality           Signed 22 May 2026  [Download]
  ✓  Criminal Record Self-Dec  Signed 22 May 2026  [Download]
  ✓  Working Time Opt-Out      Signed 22 May 2026  [Download]

─── Contract & Checks ──────────────────────────────────────
  ✓  Offer Letter & Contract   Signed 22 May 2026  [Download]
  ✓  Supervision Contract      Signed 22 May 2026  [Download]
  ✓  Employment History Reg 19 Signed 22 May 2026  [Download]

[Download full pack ↓]   [Confirm Receipt]
```

**Data source**
The per-form signed dates come from `invite.formProgress`. Individual [Download] buttons
require the pack to have been downloaded in this HR browser session (TASK 2.4) — they
enumerate the manifest and save the individual file from the in-memory ZIP.

If the pack has not been downloaded yet in this session, individual [Download] buttons are
disabled with a tooltip "Download the pack first".

**Acceptance criteria**
- All 15 forms appear in their correct category groups.
- Completed forms show a green tick and signed date; incomplete forms show an amber dash.
- Individual [Download] buttons save the correct HTML file from the decrypted ZIP.
- [Download full pack] saves the entire ZIP.
- This view is accessible for `received` status candidates too (pack purged from relay, but
  if HR already downloaded it in this session, the in-memory ZIP is still available).

**Dependencies:** TASK 4.2, TASK 2.4.

---

### TASK 4.4 — New candidate invite form

**What to build**
A form within the HR Dashboard that allows HR to create a new candidate invite without
leaving the dashboard.

**Trigger**
A "+ Invite candidate" button in the dashboard header opens a modal.

**Modal fields**

| Field | Type | Required |
|---|---|---|
| Candidate email | `<input type="email">` | Yes |
| Role / job title | `<input type="text">` | Yes, default "Support Worker" |
| Start date | `<input type="text">` | No, default "TBC" |
| Hourly rate | `<input type="text">` | No, default "£12.71/hr" |
| Contracted hours | `<input type="text">` | No, default "35 hours per week" |
| Line manager | `<input type="text">` | No, default "Josiah Millar" |

**On submit**
1. POST `/invites` with the form values.
2. Show toast "Invite sent to {email}".
3. Close the modal.
4. Re-fetch `/invites` and re-render the table (the new row appears at the top).

**Acceptance criteria**
- Submitting with a valid email and role creates an invite visible in the table immediately.
- Submitting without an email shows an inline error.
- The modal closes on success and on the × button.

**Dependencies:** TASK 4.1, TASK 3.4.

---

## PHASE 5 — Notifications

---

### TASK 5.1 — Magic-link email (candidate invite)

**What to build**
A `notifications/send-magic-link.js` module (used by TASK 3.4 POST `/invites` and
TASK 3.4 POST `/invites/:id/remind`) that sends the magic-link email to the candidate.

**Email content**

| Field | Value |
|---|---|
| From | `careers@brighterliving.co.uk` |
| Subject | `Your sign-in link for Brighter Living onboarding` |
| Body | See template below |

**HTML email template (inline CSS, no external assets)**
```
Brighter Living Care
────────────────────────────────────────────────

Hi {firstName},

We're delighted to welcome you to Brighter Living Care.

You've been offered the position of {role}. To complete your
onboarding, please fill in your forms using the secure link below.

The link expires in 7 days. You can only use it once — if you need
a new one, contact your HR team.

  [ Open my onboarding forms → ]    (button linking to the magic link URL)

If you did not expect this email, please ignore it.

────────────────────────────────────────────────
Brighter Living Care Ltd
Regus, 220 Wharfedale Road, Winnersh Triangle, RG41 5TP
careers@brighterliving.co.uk
```

**Provider**
Use Postmark (preferred), Resend, or AWS SES. The provider is configured via:
```
EMAIL_PROVIDER=postmark   # or resend / ses
EMAIL_API_KEY=...
EMAIL_FROM=careers@brighterliving.co.uk
```

The module should use a simple provider-agnostic wrapper so changing provider is a
one-line env change.

**Acceptance criteria**
- Calling the module with a valid invite ID sends an email with a working magic link.
- The link in the email routes to `https://onboarding.brighterliving.co.uk/?token=<token>`.
- Calling the module with an expired invite returns a clear error without sending.

**Dependencies:** TASK 3.2, TASK 3.4.

---

### TASK 5.2 — Pack-ready email (HR notification)

**What to build**
A `notifications/send-pack-ready.js` module triggered when a candidate successfully uploads
their encrypted pack (TASK 3.3 PUT `/packs/:id`).

**Email content**

| Field | Value |
|---|---|
| From | `careers@brighterliving.co.uk` |
| To | `process.env.HR_NOTIFY_EMAIL` |
| Subject | `Onboarding pack ready: {candidateEmail} — {role}` |
| Body | See template below |

**Template**
```
A candidate has submitted their onboarding pack and it is ready for review.

Candidate:  {candidateEmail}
Role:       {role}
Submitted:  {submittedAt formatted as DD Mon YYYY HH:MM}

Log in to the HR Dashboard to download and decrypt their pack:
  [ Open HR Dashboard → ]   (links to hr-dashboard URL)

The pack will be automatically deleted in 14 days if not downloaded.
```

**Acceptance criteria**
- When a pack is uploaded via PUT `/packs/:id`, HR receives this email within 30 seconds.
- The email contains the correct candidate email, role, and submission timestamp.

**Dependencies:** TASK 3.3, TASK 5.1 (shares the email provider wrapper).

---

## PHASE 6 — Compliance Hardening

---

### TASK 6.1 — WCAG 2.2 AA accessibility audit and fixes (candidate portal)

**What to audit and fix**

| Area | Requirement |
|---|---|
| Autocomplete tokens | Add `autocomplete="given-name"`, `"family-name"`, `"email"`, `"tel"`, `"street-address"`, `"postal-code"`, `"bday"` to the relevant personal-details fields in the profile panel and form bodies |
| `aria-live` for dynamic content | Wrap the toast `<div id="toast">` with `aria-live="polite"` and `aria-atomic="true"` |
| `aria-live` for form status | The progress bar count ("X of 15 forms complete") should have `aria-live="polite"` |
| Focus management | After `openForm(id)` is called, set focus to the form heading (`<h1>` inside `.form-view-header`) |
| Sidebar nav | `<nav>` wrapping the form list with `aria-label="Onboarding forms"` |
| Error messages | Each `.error-msg` inserted by TASK 1.3 must have `role="alert"` |
| Colour contrast | Verify all text against WCAG AA ratios. The `--muted` (`#5C4E72`) on `--bg` (`#F6F3FC`) background must achieve 4.5:1 — check and adjust if needed |
| Keyboard navigation | All form rows in the dashboard must be reachable and activatable by keyboard |
| Skip link | Add `<a class="skip-link" href="#main-content">Skip to main content</a>` as the first element in `<body>` |

**CSS additions**
```css
.skip-link { position: absolute; top: -40px; left: 0; background: var(--green); color: #fff;
             padding: 8px; z-index: 100; }
.skip-link:focus { top: 0; }
```

**Acceptance criteria**
- Running axe DevTools or Lighthouse Accessibility on the portal returns zero critical or
  serious violations.
- Tab key alone can reach every interactive element.
- Screen reader (NVDA or VoiceOver) announces form status changes when a form is completed.

**Dependencies:** TASK 1.1, TASK 1.3.

---

### TASK 6.2 — e-signature audit trail enhancement

**What to build**
Extend the signature record to include everything needed for an eIDAS-compliant audit trail.

**Current state (prototype)**
`state.submissions[id] = { status, signedName, signedAt, data }`

**Enhanced signature record**
```javascript
state.submissions[id] = {
  status:      'completed',
  signedName:  'Sarah Okonkwo',           // typed name
  signedAt:    '2026-05-22T14:33:11Z',    // ISO 8601 UTC timestamp
  signedDate:  '22 May 2026',             // human-readable for display
  sessionRef:  state.session.inviteId,    // links signature to the verified invite
  userAgent:   navigator.userAgent,       // device/browser for audit evidence
  data:        { ... }                    // from collectFormData (TASK 1.2)
}
```

**In `generateFormHTML(id)` (TASK 1.5)**
Add an "Audit record" section at the bottom of each generated form file:
```
Signature:    Sarah Okonkwo   (rendered in Brush Script cursive)
Signed at:    22 May 2026 14:33 UTC
Session ref:  a1b2c3d4-...   (invite UUID)
Platform:     Mozilla/5.0 ...
```

**In the manifest README** (generated inside the ZIP by `buildZip`), include a signature
summary table listing every form, its signed name, and its ISO timestamp.

**Acceptance criteria**
- Every completed form's generated HTML includes the audit section.
- The manifest README lists all 15 forms with their signature timestamps.
- `signedAt` is always UTC ISO 8601 (use `new Date().toISOString()`).

**Dependencies:** TASK 1.2, TASK 1.5.

---

### TASK 6.3 — Security headers and HTTPS enforcement

**What to build**
Add security HTTP response headers to the backend service (all endpoints from Tasks 3.2–3.4).

**Headers to set on every response**

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**For the PUT `/packs/:id` endpoint specifically**, also enforce:
```
Content-Type: application/octet-stream   (reject anything else with 415)
```

**Rate limiting**
- POST `/auth/verify`: max 10 requests per IP per 15 minutes.
- POST `/invites`: max 50 requests per IP per hour.
- Use an in-process token-bucket (e.g. `fastify-rate-limit` or `slowapi`).

**CORS**
- Allow only `https://onboarding.brighterliving.co.uk` and
  `https://hr.brighterliving.co.uk` as origins.
- Reject all other origins with 403.

**Acceptance criteria**
- `curl -I https://onboarding.brighterliving.co.uk/auth/verify` returns all seven headers.
- Sending 11 verify requests in under a minute from the same IP returns 429 on the 11th.
- Sending a PUT `/packs/:id` with `Content-Type: application/json` returns 415.

**Dependencies:** TASK 3.2, TASK 3.3.

---

## Appendix: Task → Spec Section Cross-Reference

| Task | Spec section |
|---|---|
| 1.1 Modularise portal ✅ | §3.3 stack, §5 candidate portal |
| 1.2 collectFormData ✅ | §4.3 form-answer capture |
| 1.3 Validation ✅ | §5.5 validation |
| 1.4 Encrypted draft ✅ | §4.1 data lifecycle, §7.1 local draft |
| 1.5 generateFormHTML with real data ✅ | §4.2 downloadable folder, §4.3 |
| 1.6 Progress reporting to API ✅ | §5 candidate portal, §3.2 data flow |
| ~~2.1 HR key pair utility~~ | *removed — superseded by server-side KMS* |
| ~~2.2 Client-side encryption module~~ | *removed — superseded by server-side KMS* |
| 2.3 Pack build + relay upload ✅ | §3.2 data flow (package + hand-off steps) |
| 2.4 HR authenticated pack download | §3.2 data flow (retrieve step), §6.4 |
| 3.1 DB schema ✅ | §3.3 metadata store, §4.1 data lifecycle |
| 3.2 Magic-link endpoints ✅ | §5.1 authentication, §8 service interfaces |
| 3.3 Relay endpoints (server-side KMS) ✅ | §3.3 stack, §7.1, §8 |
| 3.4 Invite CRUD ✅ | §6 HR dashboard, §8 |
| 3.5 Scheduled metadata purge ✅ | §4.1 data lifecycle ("purged on a scheduled job") |
| 4.1 HR shell + login + metrics | §6.1, §6.2 |
| 4.2 Submission tracking matrix | §6.3 |
| 4.3 Record inspector | §6.4 |
| 4.4 New invite form | §6.5, §8 POST /invites |
| 5.1 Magic-link email | §3.1 notify service |
| 5.2 Pack-ready email | §3.1 notify service |
| 6.1 Accessibility | §9 NFRs |
| 6.2 e-signature audit trail | §5.4, §7.3 e-signature validity |
| 6.3 Security headers | §7.1, §9 NFRs |
