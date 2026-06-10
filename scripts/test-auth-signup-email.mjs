/**
 * Smoke-test patient signup email delivery (Supabase signUp → confirmation email).
 *
 *   npm run test:auth-signup-email
 *   npm run test:auth-signup-email -- --email=test@example.com
 */
import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function readEmailArg() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--email=')) return arg.slice('--email='.length).trim();
  }
  return `smtp-test-${Date.now()}@gmail.com`;
}

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const email = readEmailArg();
const password = `Elix-${Date.now().toString(36)}-Test9!`;
const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

console.log(`Testing signUp email delivery for: ${email}`);

const registered = await supabase.rpc('is_auth_email_registered', { p_email: email });
if (registered.data === true) {
  console.error('Email already registered — use a different --email= address.');
  process.exit(1);
}

const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { role: 'patient', full_name: 'SMTP Test' }
  }
});

if (error) {
  console.error('FAIL: signUp returned error:', error.message);
  if (error.message.toLowerCase().includes('error sending confirmation')) {
    console.error('\nSupabase still cannot send email. Run: npm run db:apply-auth-smtp');
    console.error('Or check Dashboard → Logs → Auth for the SMTP error.');
  }
  process.exit(1);
}

const identities = data.user?.identities?.length ?? 0;
const hasSession = Boolean(data.session);

console.log('OK: signUp succeeded without mailer error.');
console.log(`  User id: ${data.user?.id ?? '(none)'}`);
console.log(`  Identities: ${identities}`);
console.log(`  Session returned: ${hasSession}`);
console.log(`  Expect verification email at ${email} (check spam).`);

if (serviceKey && data.user?.id) {
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(data.user.id);
  console.log('  Cleaned up test auth user.');
}

process.exit(0);
