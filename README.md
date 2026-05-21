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

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
```
