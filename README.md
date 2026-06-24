# NOTAP Backend

Express API for the NOTAP compliance platform. Deploy on **Netlify** (serverless functions) or Vercel (`/api`).

## Netlify (recommended)

1. Create a site from `git@github-account1:anjorintosin/notap-backend.git`
2. Build settings are in `netlify.toml` (`npm run build`, functions in `netlify/functions`)
3. Set environment variables in **Site configuration → Environment variables** (see list below)
4. Run `npm run seed` once against production `DATABASE_URL` to sync schema + admin
5. Set `FRONTEND_URL` to your Netlify frontend URL (e.g. `https://notap-frontend.netlify.app`)

API base URL for the frontend: `https://<your-backend-site>.netlify.app/api/v1`

Scheduled renewal checks run via `netlify/functions/scheduled-renewals.ts` (daily). Set `CRON_SECRET` if you trigger manually.

## Vercel project settings

In **Settings → Build & Development**:

| Setting | Value |
|---------|--------|
| Framework Preset | **Other** |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty)* |
| Install Command | `npm install` |
| Node.js Version | **22.x** |

Do **not** set Output Directory to `public` or `dist` — this repo is API-only, not a static site.

If the dashboard forces a build command, use `npm run build` and keep the empty `public/` folder in the repo.

## Required environment variables on Vercel

Your local `.env` is **not** deployed. Add these in **Settings → Environment Variables** (Production):

- `DATABASE_URL` (or `DB_*` + `DB_SSL=true`) — for **Aiven**, keep `ca.pem` in the repo root (or set `DB_SSL_CA=./ca.pem`)
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- `FRONTEND_URL` (your live frontend URL, e.g. `https://notap-frontend.netlify.app` — no trailing slash)
- Optional: `CORS_ORIGINS` (comma-separated extra origins)
- CORS allows `https://*.netlify.app`, `https://*.vercel.app`, and `FRONTEND_URL` by default
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (required for file uploads on serverless)
- `SMTP_*`, `CRON_SECRET`, etc.

Logs showing `injected env (0) from .env` mean **no variables were loaded** — fix that in the Vercel dashboard.

## Seed the NOTAP admin (production)

**Do not** add seeding to the Vercel **build** command — builds should not write to the database.

### Option A — One-time from your laptop (recommended)

1. Copy `DATABASE_URL` from Vercel → backend project → Settings → Environment Variables.
2. Run:

```bash
cd notap-backend
DATABASE_URL="postgresql://..." npm run seed
```

Default login (unless overridden): `admin@notap.gov.ng` / `password123`

### Option B — Auto-seed on first API request (Vercel)

1. In Vercel env vars, set `SEED_ADMIN=true` (Production only, for first deploy).
2. Redeploy, then hit any route (e.g. `/health`) once — bootstrap creates the admin if missing.
3. Remove `SEED_ADMIN` or set `SEED_ADMIN=false` after the admin exists.

Optional overrides: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`.

### Vercel cold start / timeout

On Vercel, bootstrap runs in **light** mode (no `sync({ alter })`, no RBAC re-seed on every request). Run `npm run seed` once against production DB, or set `BOOTSTRAP_FULL=true` for a single deploy then remove it.

Do **not** set `DB_SYNC_ALTER=true` on Vercel (causes 60s+ timeouts).

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
```
