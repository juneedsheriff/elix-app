/**
 * Validates RESEND_API_KEY can send from SMTP_ADMIN_EMAIL.
 *
 *   npm run test:resend-api-key
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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

loadEnvFile('.env.local');

const apiKey = process.env.RESEND_API_KEY?.trim();
const fromEmail = process.env.SMTP_ADMIN_EMAIL?.trim();
const senderName = process.env.SMTP_SENDER_NAME?.trim() || 'ElixClinix Health';

if (!apiKey || !fromEmail) {
  console.error('Missing RESEND_API_KEY or SMTP_ADMIN_EMAIL in .env.local');
  process.exit(1);
}

console.log(`Testing Resend API key for sender: ${senderName} <${fromEmail}>`);

const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    from: `${senderName} <${fromEmail}>`,
    to: ['delivered@resend.dev'],
    subject: 'ElixClinix Resend API key test',
    html: '<p>If you see this in Resend logs, the API key and sender domain are valid.</p>'
  })
});

const body = await response.json();

if (!response.ok) {
  console.error('FAIL:', body.message ?? JSON.stringify(body));
  if (body.message?.includes('domain') && body.message?.includes('verified')) {
    console.error('\nFix: Resend → API Keys → create a key with Full access OR linked to verified domain app.elixclinix.com');
    console.error('Then update RESEND_API_KEY in .env.local and run: npm run db:apply-auth-smtp');
  }
  process.exit(1);
}

console.log('OK: Resend accepted the send request.');
console.log(`  Email id: ${body.id ?? '(none)'}`);
console.log('Next: npm run db:apply-auth-smtp && npm run test:auth-signup-email');
