# Supabase setup

## Email confirmation / password reset redirects

If verification links open `localhost:3000` with `otp_expired` or `access_denied`, fix **Authentication → URL Configuration** in the Supabase Dashboard:

| Setting | Value |
|---------|--------|
| **Site URL** | `http://localhost:3000` (dev) or `https://your-app.vercel.app` (prod) |
| **Redirect URLs** | Add every URL users may land on after clicking email links: |

```
http://localhost:3000/**
https://your-app.vercel.app/**
```

- Run the dev server on port **3000**: `npm run dev` (see `vite.config.js`).
- For production, set `VITE_APP_URL=https://your-app.vercel.app` in Vercel env vars.
- Confirmation links expire (often ~1 hour). Use **Resend confirmation email** on the sign-in screen if a link is old.
- Request a **new** signup or resend after changing redirect URLs; old emails still point at the previous URL.

## Quick fix: tables not created

### Option 1 — SQL Editor (recommended)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Click **New query**
3. Copy the entire file [`schema.sql`](./schema.sql) and paste it
4. Click **Run** (you should see “Success”)
5. In the app folder terminal:

```bash
npm run db:seed
npm run db:seed-records
```

6. Restart the dev server: `npm run dev`

### Option 2 — CLI script

Add to `.env.server.local` (see `.env.server.example`):

- `POSTGRES_URL_NON_POOLING` — Database → Connection string → URI (port **5432**)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Then:

```bash
npm run db:setup
```

## Tables created

| Table | Purpose |
|-------|---------|
| `doctors` | Specialist directory |
| `admins` | Platform administrators (Supabase Auth login) |
| `patients` | Patient profiles (linked to Auth); public ID `elix_id` (e.g. `elix-aa0000`) |
| `uploaded_files` | Uploaded file metadata (name, size, Storage path) |
| `medical_records` | Legacy table — migrate with `004_uploaded_files.sql` |
| `opinion_requests` | Second opinion requests — run `006_doctor_opinion_access.sql` (doctor read) and `009_opinion_doctor_response.sql` (respond to patient) |
| `opinion_request_records` | Records linked to a request |

Storage bucket: `medical-records` (PDF, JPG, DOC uploads)

Demo rows from `npm run db:seed-records` are metadata only until you run:

```bash
npm run db:assign-records    # optional: attach null user_id rows to a patient
npm run db:upload-record-files   # upload PDF/JPEG blobs under the patient's auth folder
npm run db:migrate-records-to-r2 # copy existing Supabase Storage blobs → Cloudflare R2
npm run db:migrate-r2-to-elix-id   # move R2 objects from {auth_user_id}/ → {elix_id}/
npm run db:apply-elix-id         # patient elix_id column (or run 010_patient_elix_id.sql in SQL Editor)
npm run db:apply-admins          # admins table + RLS
npm run db:seed-admin            # create admin auth user (see scripts/admin-credentials.mjs)
```

## Verify in Dashboard

**Table Editor** should list `doctors`, `patients`, `uploaded_files`, `opinion_requests`, `opinion_request_records`.

**Storage** should show bucket `medical-records`.
