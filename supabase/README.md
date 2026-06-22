# Supabase setup

## Patient signup email verification (Custom SMTP)

Patient registration sends a **6-digit code** via Supabase Auth (`signUp` → `verifyOtp`). If signup shows `Error sending confirmation email`, the built-in Supabase mailer is failing — configure **Custom SMTP**.

### Quick apply (recommended)

1. Create a [Resend](https://resend.com) API key and verify your sending domain.
2. Add to `.env.local` (server-only — no `VITE_` prefix):

```env
SUPABASE_ACCESS_TOKEN=sbp_...
RESEND_API_KEY=re_...
SMTP_ADMIN_EMAIL=noreply@yourdomain.com
SMTP_SENDER_NAME=ElixClinix Health
SITE_URL=http://localhost:3000
URI_ALLOW_LIST=http://localhost:3000/**,https://your-app.vercel.app/**
```

3. Apply SMTP + OTP email template:

```bash
npm run db:apply-auth-smtp
npm run test:auth-signup-email
```

The script sets Resend SMTP (`smtp.resend.com`) and updates the **Confirm signup** template to include `{{ .Token }}` (see [`templates/confirmation-signup-email.html`](./templates/confirmation-signup-email.html)).

### Manual dashboard setup

[Supabase Dashboard](https://supabase.com/dashboard) → project → **Authentication → Email → SMTP Settings**:

| Field | Resend value |
|-------|----------------|
| Enable Custom SMTP | On |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Username | `resend` |
| Password | Resend API key (full-access or verified-domain key) |
| Sender email | Address on your verified domain |
| Sender name | `ElixClinix Health` |

**Authentication → Email Templates → Confirm signup** — body must include:

```html
<p>Your verification code is: <strong>{{ .Token }}</strong></p>
```

Without `{{ .Token }}`, users only get a magic link and the in-app code field will not work.

Keep **Confirm email** enabled under **Authentication → Providers → Email**.

If sends still fail, check **Logs → Auth** for the underlying SMTP error (auth failed, domain not verified, rate limit).

### Password reset (`Error sending recovery email`)

Forgot password uses the **same Resend SMTP** as signup. If recovery fails:

```bash
npm run db:show-auth-smtp          # live sender + redirect URLs
npm run test:auth-recovery-email -- --email=registered-user@example.com
```

Common fixes:

1. **Resend domain** — `SMTP_ADMIN_EMAIL` must use a domain verified in [Resend → Domains](https://resend.com/domains).
2. **API key** — must have **Full access** or be linked to verified **`app.elixclinix.com`**. Domain-scoped keys for unverified domains fail with “Error sending … email”. Run `npm run test:resend-api-key`, then update `RESEND_API_KEY` and `npm run db:apply-auth-smtp`.
3. **SMTP port** — try `SMTP_PORT=587` (or `465`) in `.env.local` and re-apply.
4. **Supabase Auth logs** — Dashboard → **Logs → Auth** shows the exact SMTP error from Resend.
5. **Redirect URLs** — set `VITE_APP_URL` to your production URL and run `npm run db:apply-production-urls`.

#### Elix Clinix: `support@elixclinix.com`

The app sender is **`support@elixclinix.com`**. That requires the **root domain** `elixclinix.com` verified in Resend (separate from `app.elixclinix.com`, which only allows `@app.elixclinix.com` addresses).

1. Resend → **Domains** → **Add domain** → enter `elixclinix.com` (region: Tokyo, same as `app`).
2. In IONOS DNS for `elixclinix.com`, add the records Resend shows (host names are relative to the root zone):

| Type | Host (IONOS) | Example value |
|------|--------------|---------------|
| TXT | `resend._domainkey` | DKIM key from Resend |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

3. Wait until Resend shows **Verified** for `elixclinix.com`.
4. Run `npm run db:apply-auth-smtp` and `npm run test:auth-signup-email`.

Until `elixclinix.com` is verified, password reset and signup emails will fail with “Error sending … email”.

### After SMTP works

1. Confirm registration reaches the **Enter 6-digit code** step (not the password step immediately).
2. Set `ALLOW_EMAILLESS_PATIENT_SIGNUP = "false"` in [`workers/admin-auth/wrangler.toml`](../workers/admin-auth/wrangler.toml) and run `npm run worker:admin-auth:deploy` so signup always requires email verification.

### Emailless fallback (dev only)

When SMTP is broken, the app can skip verification via the admin-auth worker (`ALLOW_EMAILLESS_PATIENT_SIGNUP=true`). Disable this once Custom SMTP is stable.

---

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
| `opinion_requests` | Doctor consultation requests — run `006_doctor_opinion_access.sql` (doctor read) and `009_opinion_doctor_response.sql` (respond to patient) |
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
