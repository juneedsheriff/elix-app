# Medical records — Cloudflare R2 worker

Patient uploads are stored in **Cloudflare R2** under `{elix_id}/` (e.g. `elix-aa0000/uuid-report.pdf`). Legacy files under `{auth_user_id}/` remain accessible. Supabase keeps auth and file metadata (`uploaded_files`); this worker proxies uploads/downloads through the R2 binding (no separate R2 API tokens required).

## One-time setup

```bash
cd workers/medical-records
npm install
npx wrangler login
# Same anon key as .env.local:
npx wrangler secret put SUPABASE_ANON_KEY
npm run deploy
```

Copy the deployed URL into the app root `.env.local`:

```env
VITE_R2_API_URL=https://elix-medical-records.<your-subdomain>.workers.dev
```

Restart `npm run dev`.

## Local dev

```bash
npm run dev
```

Use `http://127.0.0.1:8787` as `VITE_R2_API_URL` while the worker is running locally.
