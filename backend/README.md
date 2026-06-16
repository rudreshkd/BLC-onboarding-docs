# Brighter Living — Invite & Identity Service (Phase 3)

Node.js + Fastify backend for the candidate onboarding portal: magic-link auth,
KMS-style encrypted pack relay, invite CRUD, and a scheduled metadata purge.

## Local setup

```bash
# 1. Postgres (Homebrew)
brew install postgresql@16 && brew services start postgresql@16
createdb bl_onboarding
createdb bl_onboarding_test

# 2. Config
cp .env.example .env
#   set JWT_SECRET, HR_PASSWORD_HASH (bcrypt), LOCAL_KMS_MASTER_KEY (base64 of 32 random bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # LOCAL_KMS_MASTER_KEY
node -e "console.log(require('bcryptjs').hashSync('your-hr-password',10))"     # HR_PASSWORD_HASH

# 3. Install + migrate + run
npm install
npm run migrate
npm start
```

## Commands

| Command | What |
|---|---|
| `npm run migrate` | Apply `migrations/*.sql` (idempotent, tracked in `schema_migrations`) |
| `npm start` | Run the API on `PORT` (default 3000) |
| `npm test` | Run the suite serialized (`--test-concurrency=1`) against `bl_onboarding_test` |
| `npm run purge` | Run the metadata purge once (schedule via cron: `0 2 * * *`) |

## Endpoints

- `POST /auth/invite-link` — issue a magic link (internal)
- `POST /auth/verify` — verify token → candidate session JWT + offer terms
- `PUT /packs/:id` — candidate uploads ZIP (encrypted at rest)
- `GET /packs/:id` — HR downloads decrypted ZIP
- `POST /packs/:id/receipt` — HR confirms receipt → purge object
- `POST /invites`, `GET /invites`, `PATCH /invites/:id/progress`, `POST /invites/:id/remind`
- `POST /hr/auth/login` — HR login → `role:hr` JWT

## Architecture notes

- **Adapters** (`src/adapters/`) abstract storage + KMS. Only `local` impls ship
  (filesystem + local AES key-wrapping). AWS S3/KMS adapters are deferred to deploy.
- **Encryption at rest** protects against DB/storage/backup theft, not a live-server
  compromise (the server holds the data key transiently to serve an authenticated GET).
- The candidate JWT `sub` is the `inviteId`; `PUT /packs/:id` enforces `sub === id`.
