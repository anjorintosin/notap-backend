# NOTAP Backend

Express API for the NOTAP compliance platform. Deployed on Vercel as serverless functions (`/api`).

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

- `DATABASE_URL` (or `DB_*` + `DB_SSL=true`)
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- `FRONTEND_URL`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (required for file uploads on serverless)
- `SMTP_*`, `CRON_SECRET`, etc.

Logs showing `injected env (0) from .env` mean **no variables were loaded** — fix that in the Vercel dashboard.

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
```
