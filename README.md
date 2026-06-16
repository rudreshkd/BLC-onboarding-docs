# Brighter Living Onboarding — Local Setup

Three services make up the app:

| Service | Default port | What it is |
|---|---|---|
| **Backend API** | `3000` | Node.js + Fastify + Postgres |
| **Candidate Portal** | `8080` | Static SPA — new-hire onboarding journey |
| **HR Dashboard** | `8081` | Static SPA — invite management & record review |

---

## Prerequisites

- **Node.js ≥ 22** (`node --version`)
- **PostgreSQL 16** running locally (`pg_isready` should print `accepting connections`)
  - Install: `brew install postgresql@16 && brew services start postgresql@16`

---

## One-time setup

### 1. Create databases

```bash
createdb bl_onboarding
createdb bl_onboarding_test   # only needed if you run the test suite
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in the three required values:

```bash
# 32-byte base64 key for local pack encryption
LOCAL_KMS_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# bcrypt hash of the HR password you want to use
# Replace 'your-password' with something real
node -e "import('bcryptjs').then(m => console.log(m.default.hashSync('your-password', 10)))"
```

Paste the outputs into `.env`:

```
JWT_SECRET=<any long random string>
LOCAL_KMS_MASTER_KEY=<output from first command>
HR_EMAIL=hr@brighterliving.co.uk
HR_PASSWORD_HASH=<output from second command>
```

The rest of the defaults in `.env.example` work as-is for local dev.

### 3. Install dependencies and run migrations

```bash
cd backend
npm install
npm run migrate
```

---

## Running the app

Open three terminal tabs:

```bash
# Tab 1 — Backend API
cd backend && npm start

# Tab 2 — Candidate Portal
npx serve portal -p 8080

# Tab 3 — HR Dashboard
npx serve hr-dashboard -p 8081
```

Verify everything is up:

```bash
curl http://localhost:3000/health    # → {"status":"ok"}
curl -o /dev/null -w "%{http_code}" http://localhost:8080/   # → 200
curl -o /dev/null -w "%{http_code}" http://localhost:8081/   # → 200
```

---

## Logging in

**HR Dashboard** (`http://localhost:8081`)
- Email: whatever you set as `HR_EMAIL` in `.env`
- Password: whatever you hashed for `HR_PASSWORD_HASH`

**Candidate Portal** (`http://localhost:8080`)
- Candidates receive a magic-link token via `POST /auth/invite-link` (HR triggers this from the dashboard). The link encodes the token; no password needed.

---

## Other commands

```bash
# Run the backend test suite (uses bl_onboarding_test database)
cd backend && npm test

# Manually run the metadata purge (normally run nightly via cron)
cd backend && npm run purge
```

---

## Project layout

```
backend/          Node.js + Fastify API
  src/            Application source
  migrations/     SQL migrations (idempotent, tracked in schema_migrations)
  scripts/        migrate.js, purge-old-invites.js
portal/           Candidate-facing static SPA
hr-dashboard/     HR admin static SPA
```
