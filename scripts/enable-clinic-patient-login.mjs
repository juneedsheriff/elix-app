/**
 * Apply claim-patient migration (if needed) and enable login for one patient email.
 * Usage: node scripts/enable-clinic-patient-login.mjs datascribetech@gmail.com
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PATIENT_PASSWORD } from './patient-credentials.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const email = (process.argv[2] ?? '').trim().toLowerCase();

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/enable-clinic-patient-login.mjs <patient-email>');
  process.exit(1);
}

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.server.local');
loadEnvFile('.env.local');

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim();

if (!dbPassword) {
  console.error('Set SUPABASE_DB_PASSWORD in .env.local');
  process.exit(1);
}

const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ||
  'juwlzcxlekqttpdqqijv';
const region = process.env.SUPABASE_DB_REGION?.trim() || 'us-east-1';
const pooler = process.env.SUPABASE_DB_POOLER?.trim() || 'aws-1';
const encoded = encodeURIComponent(dbPassword);
const urls = [
  process.env.POSTGRES_URL_NON_POOLING?.trim(),
  process.env.POSTGRES_URL?.trim(),
  `postgresql://postgres.${projectRef}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres`
].filter(Boolean);

const migrationSql = readFileSync(
  join(root, 'supabase/migrations/065_claim_clinic_patient_login.sql'),
  'utf8'
);

let migrationApplied = false;
let lastDbError;
for (const connectionString of urls) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(migrationSql);
    migrationApplied = true;
    console.log('Applied 065_claim_clinic_patient_login.sql');
    break;
  } catch (error) {
    lastDbError = error;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

if (!migrationApplied) {
  console.error('Migration failed:', lastDbError?.message ?? 'no database connection');
  process.exit(1);
}

if (!supabaseUrl || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: patient, error: patientError } = await admin
  .from('patients')
  .select('id, full_name, email, auth_user_id, login_disabled, clinic_id')
  .ilike('email', email)
  .maybeSingle();

if (patientError || !patient) {
  console.error('Patient not found:', patientError?.message ?? email);
  process.exit(1);
}

console.log(`Found patient: ${patient.full_name} (clinic_id: ${patient.clinic_id ?? 'global'})`);

async function findAuthUserByEmail() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data.users) return null;
  return data.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
}

let authUserId = patient.auth_user_id;

if (!authUserId) {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PATIENT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: 'patient',
      patient_id: patient.id,
      full_name: patient.full_name
    }
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes('already')) {
      authUserId = await findAuthUserByEmail();
      if (!authUserId) {
        console.error('Auth email exists but user could not be found:', authError.message);
        process.exit(1);
      }
      console.log('Using existing auth user.');
    } else {
      console.error('Auth create failed:', authError.message);
      process.exit(1);
    }
  } else {
    authUserId = authData.user?.id ?? null;
    console.log('Created auth user.');
  }
}

if (!authUserId) {
  console.error('Could not resolve auth user id.');
  process.exit(1);
}

const { error: authUpdateError } = await admin.auth.admin.updateUserById(authUserId, {
  password: DEFAULT_PATIENT_PASSWORD,
  ban_duration: 'none'
});
if (authUpdateError) {
  console.error('Auth update failed:', authUpdateError.message);
  process.exit(1);
}

const { error: linkError } = await admin
  .from('patients')
  .update({
    auth_user_id: authUserId,
    login_disabled: false,
    updated_at: new Date().toISOString()
  })
  .eq('id', patient.id);

if (linkError) {
  console.error('Failed to link patient profile:', linkError.message);
  process.exit(1);
}

console.log(`Patient login enabled for ${email}`);
console.log(`Password set to default: ${DEFAULT_PATIENT_PASSWORD}`);
