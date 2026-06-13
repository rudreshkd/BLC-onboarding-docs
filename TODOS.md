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

## TODO-3: Wire Phase 2 encryption to the live relay (backend)

**What:** Stand up the two endpoints the Phase 2 client already calls: `GET /keys/hr-public` (serves the base64 SPKI from `HR_PUBLIC_KEY`, produced by `hr-keygen.html`) and `PUT /packs/{inviteId}` (accepts the `application/octet-stream` encrypted payload).

**Why:** Phase 2 (TASK 2.1–2.3) is built and verified client-side. `submit.js` builds the ZIP, fetches HR's public key, envelope-encrypts (AES-GCM 256 wrapped with RSA-OAEP 4096), and PUTs the ciphertext. With no backend, `submitPackToHR()` returns `no-backend` and the journey completes locally — the real upload lights up automatically once these endpoints exist, with no client change.

**Context:** Public key endpoint reads `process.env.HR_PUBLIC_KEY` (TASK 3.3). Pack endpoint stores the opaque ciphertext (S3/blob) keyed by `inviteId`, gated on the candidate JWT (TASK 3.2). Decryption happens only in the HR Dashboard with the private key (TASK 2.4 — not yet built).

**Depends on:** Phase 3 (TASK 3.2, 3.3, 3.4). Unblocks TASK 2.4 (HR-side decryption).
