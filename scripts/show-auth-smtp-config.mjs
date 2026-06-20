/**
 * Read-only: show Supabase Auth SMTP + URL config (no secrets).
 *
 *   npm run db:show-auth-smtp
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';

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

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});

const config = await response.json();
if (!response.ok) {
  console.error('Failed to load auth config:', config?.message ?? response.status);
  process.exit(1);
}

const smtpOn = Boolean(config.smtp_host?.trim() && config.smtp_admin_email?.trim());

console.log('Supabase Auth email configuration\n');
console.log(`  Custom SMTP: ${smtpOn ? 'enabled' : 'NOT configured'}`);
console.log(`  SMTP host: ${config.smtp_host || '(default Supabase mailer)'}`);
console.log(`  SMTP port: ${config.smtp_port ?? '(default)'}`);
console.log(`  Sender: ${config.smtp_sender_name || '(none)'} <${config.smtp_admin_email || '(none)'}>`);
console.log(`  Site URL: ${config.site_url || '(none)'}`);
console.log(`  Redirect allow list: ${config.uri_allow_list || '(none)'}`);
console.log(`  External email enabled: ${config.external_email_enabled ?? '(unknown)'}`);

if (process.env.SMTP_ADMIN_EMAIL?.trim() && process.env.SMTP_ADMIN_EMAIL.trim() !== config.smtp_admin_email?.trim()) {
  console.log('\n  Note: .env.local SMTP_ADMIN_EMAIL differs from live Supabase sender.');
  console.log(`    .env.local: ${process.env.SMTP_ADMIN_EMAIL.trim()}`);
  console.log(`    Supabase:   ${config.smtp_admin_email || '(none)'}`);
  console.log('    Run: npm run db:apply-auth-smtp');
}

console.log('\nLocal env (for apply script):');
console.log(`  SMTP_ADMIN_EMAIL: ${process.env.SMTP_ADMIN_EMAIL || '(not set)'}`);
console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '(set)' : '(not set)'}`);
console.log(`  VITE_APP_URL: ${process.env.VITE_APP_URL || '(not set — uses window.location.origin in app)'}`);
