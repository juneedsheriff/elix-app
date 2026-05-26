/**
 * Applies 011_admins.sql to Supabase Postgres.
 *   npm run db:apply-admins
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sqlPath = join(root, 'supabase/migrations/011_admins.sql');
const sql = readFileSync(sqlPath, 'utf8');
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function probeAdmins() {
  if (!supabaseUrl || !serviceKey) return false;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.from('admins').select('id').limit(1);
  return !error;
}

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
    `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`
  ];
}

function resolveConnectionStrings() {
  const explicit =
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (explicit) return [explicit];
  return buildDbUrlsFromPassword();
}

async function applyWithPg(connectionStrings) {
  let lastError;
  for (const connectionString of connectionStrings) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      return;
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

if (await probeAdmins()) {
  console.log('public.admins already exists.');
  process.exit(0);
}

console.log('Applying 011_admins.sql…');

const connectionStrings = resolveConnectionStrings();
if (!connectionStrings.length) {
  console.error('Set SUPABASE_DB_PASSWORD or POSTGRES_URL_NON_POOLING in .env.local');
  process.exit(1);
}

try {
  await applyWithPg(connectionStrings);
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}

if (!(await probeAdmins())) {
  console.error('Migration ran but public.admins is still missing.');
  process.exit(1);
}

console.log('Done. Run: npm run db:seed-admin');
