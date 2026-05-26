/**
 * Creates the platform admin in Supabase Auth and public.admins.
 * Run after 011_admins.sql: npm run db:seed-admin
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL, ADMIN_FULL_NAME, ADMIN_PASSWORD } from './admin-credentials.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL ?? ADMIN_EMAIL).trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME ?? ADMIN_FULL_NAME;

if (!url || !key?.trim()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { error: tableError } = await supabase.from('admins').select('id').limit(1);
if (tableError) {
  console.error('admins table missing. Run: npm run db:apply-admins');
  process.exit(1);
}

const { data: existingRow } = await supabase
  .from('admins')
  .select('id, auth_user_id, email')
  .ilike('email', email)
  .maybeSingle();

async function findAuthUserByEmail() {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users?.find((u) => u.email?.toLowerCase() === email) ?? null;
}

let authUserId = existingRow?.auth_user_id ?? null;

if (!authUserId) {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin', full_name: fullName }
  });

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      const existing = await findAuthUserByEmail();
      if (!existing) {
        console.error('Email registered but user not found:', email);
        process.exit(1);
      }
      authUserId = existing.id;
      await supabase.auth.admin.updateUserById(authUserId, {
        password,
        user_metadata: { role: 'admin', full_name: fullName }
      });
      console.log('Linked existing auth user and updated password.');
    } else {
      console.error('Auth create failed:', authError.message);
      process.exit(1);
    }
  } else {
    authUserId = authData.user?.id ?? null;
    console.log('Created Supabase Auth user.');
  }
} else {
  await supabase.auth.admin.updateUserById(authUserId, {
    password,
    user_metadata: { role: 'admin', full_name: fullName }
  });
  console.log('Admin auth user exists; password/metadata updated.');
}

if (!authUserId) {
  console.error('No auth user id for admin.');
  process.exit(1);
}

if (existingRow) {
  const { error: updateError } = await supabase
    .from('admins')
    .update({
      auth_user_id: authUserId,
      email,
      full_name: fullName,
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingRow.id);

  if (updateError) {
    console.error('Admin row update failed:', updateError.message);
    process.exit(1);
  }
  console.log(`Admin ready: ${email} (existing row ${existingRow.id})`);
} else {
  const { data: inserted, error: insertError } = await supabase
    .from('admins')
    .insert({
      auth_user_id: authUserId,
      email,
      full_name: fullName,
      is_active: true
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Admin row insert failed:', insertError.message);
    process.exit(1);
  }
  console.log(`Admin ready: ${email} (id ${inserted.id})`);
}

console.log('Sign in with this email and password in the app (admin UI can use user_metadata.role = admin).');
