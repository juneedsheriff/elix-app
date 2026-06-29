# Elix Admin Auth Worker

Secures admin-only Supabase Auth operations (enable/disable login, set password) for doctors and patients.
Also supports clinic patient auto-provisioning (enable login + generate temporary password + send welcome email).

## Setup

1. Copy `.dev.vars.example` to `.dev.vars` and fill keys (same as Supabase dashboard).
2. Set secrets in production:

```bash
cd workers/admin-auth
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
```

From the repo root (reads `RESEND_API_KEY` from `.env.local`):

```bash
npm run worker:admin-auth:secrets
```

Set worker vars (wrangler.toml or dashboard):
- `SMTP_ADMIN_EMAIL` (verified sender)
- `SMTP_SENDER_NAME` (e.g. ElixClinix)

3. Deploy:

```bash
npm run worker:admin-auth:deploy
```

4. In project root `.env.local`:

```env
VITE_ADMIN_AUTH_API_URL=https://elix-admin-auth.<your-subdomain>.workers.dev
```

For local dev, run `npm run worker:admin-auth:dev` and use `http://127.0.0.1:8788` (port 8788 avoids clashing with medical-records on 8787). Copy `.dev.vars.example` to `.dev.vars` with your Supabase keys and `ALLOWED_ORIGIN=http://localhost:3000`.

## API

- `GET /status?role=doctor|patient&profileId=<uuid>` — login status (admin JWT required)
- `POST /manage` — body: `{ role, profileId, action: "enable"|"disable"|"set_password", password? }`
- `POST /patient/provision-login` — body: `{ profileId }` (patient only): enables login with temporary password, marks first-login password change required, and sends welcome email.
