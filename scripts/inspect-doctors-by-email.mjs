/**
 * Inspect / purge recurring doctor rows by email.
 *   node scripts/inspect-doctors-by-email.mjs
 *   node scripts/inspect-doctors-by-email.mjs --purge
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
const emails = ['hajika@malinator.com', 'kequgepo@malinator.com'];
const purge = process.argv.includes('--purge');

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
    `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`
  ].filter(Boolean);
}

const urls = buildDbUrlsFromPassword();
if (!urls.length) {
  console.error('Missing SUPABASE_DB_PASSWORD');
  process.exit(1);
}

let connected = false;
let lastError;
for (const connectionString of urls) {
  const host = connectionString.replace(/:[^:@]+@/, '@').split('@')[1]?.split('/')[0];
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    connected = true;
    console.log('Connected via', host);

    const doctors = await client.query(
      `select id, full_name, email, auth_user_id, clinic_id, is_visible, login_disabled, deleted_at, created_at
       from public.doctors
       where lower(email) = any($1::text[])
       order by email, created_at`,
      [emails]
    );
    console.log('DOCTORS', JSON.stringify(doctors.rows, null, 2));

    const auth = await client.query(
      `select id, email, banned_until, deleted_at, created_at
       from auth.users
       where lower(email) = any($1::text[])`,
      [emails]
    );
    console.log('AUTH_USERS', JSON.stringify(auth.rows, null, 2));

    for (const table of ['clinic_doctor_grants', 'admin_doctor_clinic_links', 'clinic_doctor_requests']) {
      try {
        const links = await client.query(
          `select * from public.${table} where doctor_id = any($1::uuid[])`,
          [doctors.rows.map((d) => d.id)]
        );
        console.log(table.toUpperCase(), JSON.stringify(links.rows, null, 2));
      } catch (error) {
        console.log(table.toUpperCase(), 'skip:', error.message);
      }
    }

    if (purge) {
      const ids = doctors.rows.map((d) => d.id);
      if (ids.length) {
        for (const table of ['clinic_doctor_grants', 'admin_doctor_clinic_links', 'clinic_doctor_requests']) {
          try {
            const del = await client.query(
              `delete from public.${table} where doctor_id = any($1::uuid[]) returning doctor_id`,
              [ids]
            );
            console.log(`DELETED_${table.toUpperCase()}`, del.rowCount);
          } catch {
            /* ignore */
          }
        }

        const deletedDoctors = await client.query(
          `delete from public.doctors where id = any($1::uuid[]) returning id, email, full_name`,
          [ids]
        );
        console.log('DELETED_DOCTORS', deletedDoctors.rows);
      }

      for (const user of auth.rows) {
        await client.query(`delete from auth.users where id = $1`, [user.id]);
        console.log('DELETED_AUTH_USER', user.email, user.id);
      }
    } else {
      console.log('\nRe-run with --purge to hard-delete these doctor rows + auth users.');
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.log('Failed', host, error.message);
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    if (connected) process.exit(1);
  }
}

console.error(lastError?.message || 'Could not connect');
process.exit(1);
