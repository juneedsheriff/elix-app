/**
 * Configures Supabase Auth custom SMTP + signup OTP email template via Management API.
 *
 *   npm run db:apply-auth-smtp
 *
 * Required in .env.local or .env.server.local:
 *   SUPABASE_ACCESS_TOKEN=sbp_...   (https://supabase.com/dashboard/account/tokens)
 *   RESEND_API_KEY=re_...           (full-access or verified-domain key)
 *   SMTP_ADMIN_EMAIL=noreply@yourdomain.com
 *
 * Optional:
 *   SMTP_SENDER_NAME=ElixClinix Health
 *   SMTP_PORT=465                     (465 SSL or 587 STARTTLS)
 *   SITE_URL=http://localhost:3000
 *   URI_ALLOW_LIST=http://localhost:3000/**,https://your-app.vercel.app/**
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
const templateFile = 'supabase/templates/confirmation-signup-email.html';

function loadEnvFile(relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.server.local');
loadEnvFile('.env.local');

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const resendKey = process.env.RESEND_API_KEY?.trim();
const smtpAdminEmail = process.env.SMTP_ADMIN_EMAIL?.trim();
const smtpSenderName = process.env.SMTP_SENDER_NAME?.trim() || 'ElixClinix Health';
const smtpPort = process.env.SMTP_PORT?.trim() || '465';
const explicitSiteUrl = process.env.SITE_URL?.trim() || process.env.VITE_APP_URL?.trim() || null;
const explicitUriAllowList = process.env.URI_ALLOW_LIST?.trim() || null;
const productionUrl = (process.env.PRODUCTION_APP_URL ?? 'https://app.elixclinix.com').trim().replace(/\/$/, '');
const defaultUriAllowList = [
  `${productionUrl}/**`,
  'http://localhost:3000/**'
].join(',');

const confirmationSubject = process.env.SMTP_CONFIRMATION_SUBJECT?.trim() || 'Your ElixClinix verification code';
const confirmationContent = readFileSync(join(root, templateFile), 'utf8');
const mailerOtpLength = Number.parseInt(process.env.MAILER_OTP_LENGTH?.trim() || '6', 10);

function missingCredentialsMessage() {
  return `
Missing credentials for Supabase Auth SMTP setup.

Add to .env.local (server-only — do NOT prefix with VITE_):

  SUPABASE_ACCESS_TOKEN=sbp_...     https://supabase.com/dashboard/account/tokens
  RESEND_API_KEY=re_...             https://resend.com/api-keys (full-access or verified domain)
  SMTP_ADMIN_EMAIL=noreply@yourdomain.com

Optional:
  SMTP_SENDER_NAME=ElixClinix Health
  SMTP_PORT=465
  SITE_URL=http://localhost:3000
  URI_ALLOW_LIST=http://localhost:3000/**,https://your-app.vercel.app/**

Then run: npm run db:apply-auth-smtp

Or configure manually: Supabase Dashboard → Authentication → Email → SMTP Settings
and Email Templates → Confirm signup (include {{ .Token }}).
`;
}

async function managementFetch(path, init = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(typeof body === 'object' && body?.message ? body.message : text || `HTTP ${response.status}`);
  }
  return body;
}

async function getAuthConfig() {
  return managementFetch('/config/auth', { method: 'GET' });
}

function resolveSiteUrl(existing) {
  if (explicitSiteUrl) return explicitSiteUrl.replace(/\/$/, '');
  if (existing?.site_url?.trim()) return existing.site_url.trim().replace(/\/$/, '');
  return 'http://localhost:3000';
}

function resolveUriAllowList(existing) {
  if (explicitUriAllowList) return explicitUriAllowList;
  if (existing?.uri_allow_list?.trim()) return existing.uri_allow_list.trim();
  return defaultUriAllowList;
}

async function applyAuthConfig(existing) {
  const payload = {
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
    smtp_host: 'smtp.resend.com',
    smtp_port: smtpPort,
    smtp_user: 'resend',
    smtp_pass: resendKey,
    smtp_admin_email: smtpAdminEmail,
    smtp_sender_name: smtpSenderName,
    site_url: resolveSiteUrl(existing),
    uri_allow_list: resolveUriAllowList(existing),
    mailer_subjects_confirmation: confirmationSubject,
    mailer_templates_confirmation_content: confirmationContent,
    mailer_otp_length: Number.isFinite(mailerOtpLength) && mailerOtpLength >= 6 && mailerOtpLength <= 10 ? mailerOtpLength : 6
  };

  return managementFetch('/config/auth', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

function smtpConfigured(config) {
  return Boolean(config?.smtp_host?.trim() && config?.smtp_admin_email?.trim());
}

function templateHasToken(config) {
  const content = config?.mailer_templates_confirmation_content ?? '';
  return content.includes('{{ .Token }}') || content.includes('{{.Token}}');
}

if (!accessToken || !resendKey || !smtpAdminEmail) {
  console.error(missingCredentialsMessage());
  process.exit(1);
}

console.log('Applying Supabase Auth SMTP + confirmation email template…');

try {
  const before = await getAuthConfig();
  console.log(`Current SMTP host: ${before.smtp_host || '(default Supabase mailer)'}`);

  if (!explicitSiteUrl) {
    console.log(`  Preserving site URL: ${resolveSiteUrl(before)} (set SITE_URL to override)`);
  }
  if (!explicitUriAllowList) {
    console.log(`  Preserving redirect allow list (set URI_ALLOW_LIST to override)`);
  }

  const after = await applyAuthConfig(before);

  console.log('Applied custom SMTP settings.');
  console.log(`  SMTP host: ${after.smtp_host}`);
  console.log(`  Sender: ${after.smtp_sender_name} <${after.smtp_admin_email}>`);
  console.log(`  Site URL: ${after.site_url}`);
  console.log(`  Redirect allow list: ${after.uri_allow_list}`);
  console.log(`  Confirmation template includes OTP: ${templateHasToken(after) ? 'yes' : 'NO — check template'}`);
  console.log(`  OTP length: ${after.mailer_otp_length ?? '(default)'}`);

  if (!smtpConfigured(after)) {
    console.error('SMTP may not be configured correctly. Check Supabase Dashboard → Authentication → Email.');
    process.exit(1);
  }

  console.log('\nNext: npm run test:auth-signup-email');
  console.log('       npm run test:auth-recovery-email -- --email=your@account.com');
  console.log('If sends fail, verify SMTP_ADMIN_EMAIL domain in Resend and try SMTP_PORT=587.');
  console.log('After email works, set ALLOW_EMAILLESS_PATIENT_SIGNUP=false in workers/admin-auth/wrangler.toml and redeploy.');
} catch (error) {
  console.error('Failed to apply Auth SMTP config:', error.message);
  process.exit(1);
}
