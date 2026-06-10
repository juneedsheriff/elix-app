/**
 * Check whether an email exists in auth.users vs public.patients.
 * Usage: node scripts/check-email-registered.mjs worthywebsolutions@gmail.com
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

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/check-email-registered.mjs <email>');
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const rpc = await anon.rpc('is_auth_email_registered', { p_email: email });
console.log('is_auth_email_registered RPC:', rpc.data, rpc.error?.message ?? '');

const { data: patients, error: pErr } = await admin
  .from('patients')
  .select('id, email, full_name, auth_user_id, created_at')
  .ilike('email', email);
console.log('patients:', pErr?.message ?? patients);

let page = 1;
let authMatches = [];
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    console.log('auth list error:', error.message);
    break;
  }
  authMatches.push(
    ...data.users.filter((u) => (u.email ?? '').trim().toLowerCase() === email)
  );
  if (data.users.length < 1000) break;
  page += 1;
}

console.log(
  'auth.users:',
  authMatches.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.user_metadata?.role,
    confirmed: u.email_confirmed_at,
    created_at: u.created_at
  }))
);
