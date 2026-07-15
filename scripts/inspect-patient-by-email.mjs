/**
 * Inspect patient + opinion requests by email.
 *   node scripts/inspect-patient-by-email.mjs yousufsheriffskmd@gmail.com
 *   node scripts/inspect-patient-by-email.mjs yousufsheriffskmd@gmail.com --delete-orphans
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
const email = (process.argv[2] || '').trim().toLowerCase();
const deleteOrphans = process.argv.includes('--delete-orphans');

if (!email) {
  console.error('Usage: node scripts/inspect-patient-by-email.mjs <email> [--delete-orphans]');
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

function buildDbUrlsFromPassword() {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) return [];
  const ref =
    process.env.SUPABASE_PROJECT_REF?.trim() ||
    supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ||
    projectRef;
  const region = process.env.SUPABASE_DB_REGION?.trim() || 'us-east-1';
  const pooler = process.env.SUPABASE_DB_POOLER?.trim() || 'aws-1';
  const encoded = encodeURIComponent(password);
  return [
    process.env.POSTGRES_URL_NON_POOLING?.trim(),
    process.env.POSTGRES_URL?.trim(),
    process.env.DATABASE_URL?.trim(),
    `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`
  ].filter(Boolean);
}

async function withClient(fn) {
  let lastError;
  for (const connectionString of buildDbUrlsFromPassword()) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      return await fn(client);
    } catch (error) {
      lastError = error;
    } finally {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastError ?? new Error('Could not connect to Postgres');
}

await withClient(async (client) => {
  const patients = await client.query(
    `select id, full_name, email, auth_user_id, clinic_id, login_disabled, deleted_at, created_at
     from public.patients
     where lower(email) = $1`,
    [email]
  );
  console.log('PATIENTS', patients.rows);

  const users = await client.query(
    `select id, email, banned_until, deleted_at, created_at
     from auth.users
     where lower(email) = $1`,
    [email]
  );
  console.log('AUTH_USERS', users.rows);

  const authIds = [
    ...new Set(
      [...patients.rows.map((r) => r.auth_user_id), ...users.rows.map((r) => r.id)].filter(Boolean)
    )
  ];

  const nameLike = patients.rows[0]?.full_name?.trim() || email.split('@')[0];

  const requests = await client.query(
    `select id, patient_id, patient_name, clinic_id, status, doctor_name, created_at, assigned_to
     from public.opinion_requests
     where ($1::uuid[] <> '{}'::uuid[] and patient_id = any($1::uuid[]))
        or lower(coalesce(patient_name, '')) like lower('%' || $2 || '%')
        or lower(coalesce(patient_name, '')) like '%yousuf%'
        or lower(coalesce(patient_name, '')) like '%sheriff%'
     order by created_at desc`,
    [authIds, nameLike]
  );
  console.log('REQUESTS', requests.rows);

  if (!deleteOrphans) {
    console.log('\nRe-run with --delete-orphans to permanently delete the matched requests.');
    return;
  }

  const ids = requests.rows.map((r) => r.id);
  if (!ids.length) {
    console.log('No requests to delete.');
    return;
  }

  const deleted = await client.query(
    `delete from public.opinion_requests where id = any($1::uuid[]) returning id`,
    [ids]
  );
  console.log('DELETED_REQUESTS', deleted.rows);

  // Also purge soft-deleted / leftover patient profiles for this email
  const deletedPatients = await client.query(
    `delete from public.patients where lower(email) = $1 returning id, full_name, deleted_at`,
    [email]
  );
  console.log('DELETED_PATIENTS', deletedPatients.rows);

  for (const user of users.rows) {
    await client.query(`delete from auth.users where id = $1`, [user.id]);
    console.log('DELETED_AUTH_USER', user.id);
  }
});
