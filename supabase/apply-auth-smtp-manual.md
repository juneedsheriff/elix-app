# Manual Supabase Auth SMTP setup (dashboard)

Use this if `npm run db:apply-auth-smtp` cannot run (missing `SUPABASE_ACCESS_TOKEN` / Resend keys).

## 1. Custom SMTP (Resend)

Dashboard → **Authentication** → **Email** → **SMTP Settings**

| Field | Value |
|-------|--------|
| Enable Custom SMTP | On |
| Host | `smtp.resend.com` |
| Port | `465` or `587` |
| Username | `resend` |
| Password | Your Resend API key |
| Sender email | `noreply@yourdomain.com` (verified domain in Resend) |
| Sender name | `ElixClinix Health` |

## 2. Confirm signup template (6-digit OTP)

Dashboard → **Authentication** → **Email Templates** → **Confirm signup**

Subject: `Your ElixClinix verification code`

Body (must include `{{ .Token }}`):

```html
<h2>Confirm your ElixClinix account</h2>
<p>Enter this verification code in the app:</p>
<p style="font-size: 24px; letter-spacing: 4px;"><strong>{{ .Token }}</strong></p>
<p>Or use this link: <a href="{{ .ConfirmationURL }}">Confirm email</a></p>
```

Reference file: [`templates/confirmation-signup-email.html`](./templates/confirmation-signup-email.html)

## 2b. OTP length (6 digits)

Dashboard → **Authentication** → **Providers** → **Email** → set **Email OTP length** to **6**.

Or run `npm run db:apply-auth-smtp` (sets `mailer_otp_length: 6` automatically). Optional env override: `MAILER_OTP_LENGTH=6`.

## 3. URL configuration

Dashboard → **Authentication** → **URL Configuration**

| Setting | Dev | Production |
|---------|-----|------------|
| Site URL | `http://localhost:3000` | Your deployed app URL |
| Redirect URLs | `http://localhost:3000/**` | `https://your-app/**` |

Set `VITE_APP_URL` in hosting env to match production Site URL.

## 4. Verify

```bash
npm run test:auth-signup-email
```

Registration should reach **Enter 6-digit code** and email should arrive from your custom sender.

## 5. Disable emailless bypass

When email works, set in `workers/admin-auth/wrangler.toml`:

```toml
ALLOW_EMAILLESS_PATIENT_SIGNUP = "false"
```

Then: `npm run worker:admin-auth:deploy`
