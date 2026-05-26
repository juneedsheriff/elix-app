/**
 * Applies 013_admin_profile_updates.sql (admin can update doctors/patients).
 *   npm run db:apply-admin-update-policies
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(join(root, 'supabase/migrations/013_admin_profile_updates.sql'), 'utf8');
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

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
if (!password) {
  console.error('Set SUPABASE_DB_PASSWORD in .env.local');
  process.exit(1);
}

const ref =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ||
  projectRef;
const region = process.env.SUPABASE_DB_REGION?.trim() || 'us-east-1';
const pooler = process.env.SUPABASE_DB_POOLER?.trim() || 'aws-1';
const encoded = encodeURIComponent(password);
const urls = [
  process.env.POSTGRES_URL_NON_POOLING?.trim(),
  process.env.POSTGRES_URL?.trim(),
  `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`
].filter(Boolean);

console.log('Applying 013_admin_profile_updates.sql…');

let lastError;
for (const connectionString of urls) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Done. Admins can update doctor and patient profiles.');
    process.exit(0);
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

console.error('Migration failed:', lastError?.message ?? 'Could not connect');
process.exit(1);
