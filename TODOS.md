# TODOS — Brighter Living Onboarding Portal

## TODO-1: DSAR (Data Subject Access Request) support

**What:** Build a `GET /invites/:id/export` endpoint that returns all data held for a candidate as a downloadable JSON file.

**Why:** ICO can fine up to £17.5M for inability to comply with DSARs within 30 days. Requirements §6.5 states the system must support DSARs. Currently no task covers this.

**Pros:** Directly satisfies a legal requirement; single read-only endpoint; low complexity.

**Cons:** Requires defining exactly what "all data held" means (invite row + form_progress + audit_log entries — notably NOT the encrypted pack, which HR holds separately).

**Context:** The system holds: email, role, offer_terms, form_progress (completion status only, not field values), timestamps, and audit_log entries. Field values are only in the encrypted S3 pack — once that's purged, it's gone. The DSAR response should clearly note what was held and what has been deleted. Start from TASK 3.4 and add one endpoint.

**Depends on:** Phase 3 completion (TASK 3.4).

---

## TODO-2: Cross-device draft resume

**What:** Store draft state server-side via `PATCH /invites/:id/draft` so candidates can resume across devices or after a browser wipe.

**Why:** Care sector candidates frequently use shared machines (care homes, libraries) or switch between mobile and desktop. The IndexedDB draft (TASK 1.4) is scoped to the browser tab and is lost if the tab is closed or the browser's storage is cleared. This is particularly acute for a 15-form journey that takes ~1 hour.

**Pros:** Large UX win for the target audience; builds on existing JWT auth infrastructure; encrypted server-side storage is no riskier than the S3 pack.

**Cons:** Requires a new backend endpoint and a decision on encryption (encrypt with candidate's session key server-side, or store the AES-GCM ciphertext from the client). Adds server-side state for in-progress candidates.

**Context:** On `POST /auth/verify` response, include any saved draft state. On `PATCH /invites/:id/draft`, store an encrypted blob alongside the invite row (add a `draft_blob` BYTEA column to the `invites` table). Clear on pack submission. The client-side draft (TASK 1.4) continues to work as a fast local cache; the server draft is the fallback.

**Depends on:** Phase 3 completion (TASK 3.1 + 3.4), candidate JWT auth (TASK 3.2).

---

## TODO-3: Server-side pack encryption at rest (KMS) + authenticated HR download

**What:** Stand up `PUT /packs/{inviteId}` to receive the candidate's ZIP over HTTPS and encrypt it at rest with a managed KMS key. Stand up an authenticated `GET /packs/{inviteId}` that decrypts on the fly and streams the pack to HR.

**Why:** We chose server-side encryption at rest over client-side zero-knowledge keys (decision 2026-06-16). Non-technical care-home HR cannot safely custody a private-key file — losing it loses every pack, mishandling it silently breaks confidentiality. GDPR/CQC do not require zero-knowledge. KMS gives recovery, rotation, IAM, and audit, and HR never touches a key. `submit.js` now just builds the ZIP and PUTs it; `submitPackToHR()` returns `no-backend` until the relay exists, so the journey completes locally meanwhile.

**Context (PUT):** Generate a per-pack data key via KMS `GenerateDataKey`, AES-GCM the ZIP with it, store `{ ciphertext, wrappedDataKey }` in S3/blob keyed by `inviteId`, gated on the candidate JWT (TASK 3.2). **Context (GET):** authz check + audit log every access, KMS `Decrypt` the wrapped data key, decrypt and stream. Use a real cloud KMS (AWS/GCP), least-privilege IAM, retention/deletion policy. This replaces the deleted `hr-keygen.html` / client `crypto.js` / `GET /keys/hr-public` approach and the planned client-side TASK 2.4 decryption dashboard (now a server-side authenticated download).

**Depends on:** Phase 3 (TASK 3.2, 3.4) + KMS provisioning.

---

## TODO-4: Multi-user HR identity (per-user accounts)

**What:** Replace the single shared `HR_EMAIL`/`HR_PASSWORD_HASH` login with per-user HR accounts so `audit_log.actor` (`hr:{user_id}`) identifies *who* downloaded or confirmed receipt of each pack.

**Why:** A care home has multiple managers. The audit trail Phase 3 builds (`pack_downloaded`, `pack_received`, `pack_purged`) attributes every action to one shared identity, which is meaningless for CQC/GDPR accountability — you can't show who accessed a candidate's data.

**Pros:** Real per-person traceability; the schema is already ready (`audit_log.actor` encodes a user id); builds on existing JWT `role:hr` auth.

**Cons:** Needs an `hr_users` table + password management UI; pulls some Phase 4 dashboard work forward.

**Context:** TASK 4.1 deliberately specs the single hardcoded account "for now". Phase 3 implements `POST /hr/auth/login` against env vars (`backend/src/routes/hr.js`) and mints `{sub: HR_USER_ID, role:'hr'}`. To make the audit trail trustworthy, add an `hr_users` table (email, bcrypt hash, id), authenticate against it, and put the real user id in the JWT `sub`. Start from `backend/src/routes/hr.js`.

**Depends on:** Phase 3 completion + Phase 4 dashboard (TASK 4.1).

---

## TODO-5: Playwright E2E for the HR dashboard

**What:** A Playwright suite covering the real browser click-through: login → see candidate matrix → download a pack → confirm receipt → invite a candidate, against a running backend + Postgres + dashboard.

**Why:** Phase 4 chose jsdom + node:test for the dashboard's logic modules (cheap, no browser) — that catches render/wiring/escaping regressions but NOT real-DOM, event-binding, or navigation bugs on HR's only operational view of candidate data.

**Pros:** Tests what HR actually does end-to-end in a real browser; catches integration bugs the unit layer can't.

**Cons:** Pulls in a browser toolchain + CI orchestration (backend + DB + dashboard all running); slower than unit tests.

**Context:** Deferred in Phase 4 (`hr-dashboard/`, decision D2). The logic modules already have ~26 jsdom tests; this adds the missing real-browser layer. Pick it up once the dashboard UI stabilizes so selectors don't churn. Run the dashboard via a static server and point Playwright at it with the backend on localhost.

**Depends on:** Phase 4 completion.
