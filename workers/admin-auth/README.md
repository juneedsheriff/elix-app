# Elix Admin Auth Worker

Secures admin-only Supabase Auth operations (enable/disable login, set password) for doctors and patients.

## Setup

1. Copy `.dev.vars.example` to `.dev.vars` and fill keys (same as Supabase dashboard).
2. Set secrets in production:

```bash
cd workers/admin-auth
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

3. Deploy:

```bash
npm run worker:admin-auth:deploy
```

4. In project root `.env.local`:

```env
VITE_ADMIN_AUTH_API_URL=https://elix-admin-auth.<your-subdomain>.workers.dev
```

For local dev, run `npm run worker:admin-auth:dev` and use `http://localhost:8787`.

## API

- `GET /status?role=doctor|patient&profileId=<uuid>` — login status (admin JWT required)
- `POST /manage` — body: `{ role, profileId, action: "enable"|"disable"|"set_password", password? }`
