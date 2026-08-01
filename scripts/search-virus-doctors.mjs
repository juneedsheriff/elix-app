/**
 * Search doctors by name/email fragments (virus / mailinator / malinator).
 *   node scripts/search-virus-doctors.mjs
 *   node scripts/search-virus-doctors.mjs --purge
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
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
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
if (!password) {
  console.error('Missing SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const ref =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ||
  projectRef;
const region = process.env.SUPABASE_DB_REGION?.trim() || 'us-east-1';
const pooler = process.env.SUPABASE_DB_POOLER?.trim() || 'aws-1';
const encoded = encodeURIComponent(password);
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`;

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const doctors = await client.query(
  `select id, full_name, email, auth_user_id, clinic_id, is_visible, login_disabled, deleted_at, created_at
   from public.doctors
   where lower(coalesce(email,'')) like '%mailinator%'
      or lower(coalesce(email,'')) like '%malinator%'
      or lower(coalesce(full_name,'')) like '%virus%'
      or lower(coalesce(email,'')) like '%hajika%'
      or lower(coalesce(email,'')) like '%kequgepo%'
   order by created_at desc`
);
console.log('MATCHED_DOCTORS', JSON.stringify(doctors.rows, null, 2));

const recent = await client.query(
  `select id, full_name, email, clinic_id, deleted_at, created_at
   from public.doctors
   order by created_at desc
   limit 30`
);
console.log('RECENT_DOCTORS', JSON.stringify(recent.rows, null, 2));

if (purge && doctors.rows.length) {
  const ids = doctors.rows.map((d) => d.id);
  for (const table of ['clinic_doctor_grants', 'clinic_doctor_requests']) {
    try {
      const del = await client.query(
        `delete from public.${table} where doctor_id = any($1::uuid[]) returning doctor_id`,
        [ids]
      );
      console.log(`DELETED_${table.toUpperCase()}`, del.rowCount);
    } catch (error) {
      console.log(table, error.message);
    }
  }
  const deleted = await client.query(
    `delete from public.doctors where id = any($1::uuid[]) returning id, email, full_name`,
    [ids]
  );
  console.log('DELETED_DOCTORS', deleted.rows);

  const authIds = doctors.rows.map((d) => d.auth_user_id).filter(Boolean);
  if (authIds.length) {
    const authDel = await client.query(
      `delete from auth.users where id = any($1::uuid[]) returning id, email`,
      [authIds]
    );
    console.log('DELETED_AUTH', authDel.rows);
  }
} else if (!doctors.rows.length) {
  console.log('No matching doctors found for virus/mailinator/hajika/kequgepo.');
} else {
  console.log('\nRe-run with --purge to hard-delete matched doctors.');
}

await client.end();
