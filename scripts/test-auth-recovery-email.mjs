/**
 * Smoke-test password recovery email delivery.
 *
 *   npm run test:auth-recovery-email
 *   npm run test:auth-recovery-email -- --email=user@example.com
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

function readEmailArg() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--email=')) return arg.slice('--email='.length).trim();
  }
  return null;
}

function readRedirectArg() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--redirect=')) return arg.slice('--redirect='.length).trim();
  }
  const appUrl = process.env.VITE_APP_URL?.trim() || process.env.SITE_URL?.trim() || 'http://localhost:3000';
  return `${appUrl.replace(/\/$/, '')}/`;
}

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const email = readEmailArg();
if (!email) {
  console.error('Provide a registered account email: npm run test:auth-recovery-email -- --email=you@example.com');
  process.exit(1);
}

const redirectTo = readRedirectArg();
const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

console.log(`Testing resetPasswordForEmail for: ${email}`);
console.log(`  redirectTo: ${redirectTo}`);

const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

if (error) {
  console.error('FAIL:', error.message);
  if (error.message.toLowerCase().includes('error sending recovery')) {
    console.error('\nSupabase SMTP failed. Check Dashboard → Logs → Auth for details.');
    console.error('Run: npm run db:apply-auth-smtp');
  }
  process.exit(1);
}

console.log('OK: resetPasswordForEmail succeeded (check inbox/spam).');
process.exit(0);
