/**
 * Applies 010_patient_elix_id.sql to Supabase Postgres.
 *
 * Uses the first available auth method:
 *   1. POSTGRES_URL / POSTGRES_URL_NON_POOLING / DATABASE_URL
 *   2. SUPABASE_DB_PASSWORD (+ project ref from SUPABASE_URL)
 *   3. --password=... CLI flag or interactive prompt (TTY)
 *   4. SUPABASE_ACCESS_TOKEN → Supabase Management API
 *
 *   npm run db:apply-elix-id
 */
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sqlPath = join(root, 'supabase/migrations/010_patient_elix_id.sql');
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

async function probeElixId() {
  if (!supabaseUrl || !serviceKey) return false;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.from('patients').select('elix_id').limit(1);
  return !error;
}

async function showSampleIds() {
  if (!supabaseUrl || !serviceKey) return;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('patients')
    .select('elix_id, full_name')
    .order('created_at', { ascending: true })
    .limit(10);
  if (error) {
    console.error('Could not read patients:', error.message);
    return;
  }
  console.log('Sample patient IDs:');
  for (const row of data ?? []) {
    console.log(`  ${row.elix_id}  ${row.full_name}`);
  }
}

function readPasswordFromArgs() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--password=')) {
      return arg.slice('--password='.length);
    }
  }
  return null;
}

async function promptForPassword() {
  if (!input.isTTY) return null;
  const rl = createInterface({ input, output });
  try {
    return await rl.question('Supabase database password (Dashboard → Settings → Database): ');
  } finally {
    rl.close();
  }
}

function buildDbUrlsFromPassword() {
  const password =
    process.env.SUPABASE_DB_PASSWORD?.trim() || readPasswordFromArgs() || process.env.PROMPTED_DB_PASSWORD?.trim();
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

async function applyWithManagementApi(accessToken) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Management API error (${response.status})`);
  }
}

if (await probeElixId()) {
  console.log('patients.elix_id already exists.');
  await showSampleIds();
  process.exit(0);
}

console.log('Applying 010_patient_elix_id.sql…');

let connectionStrings = resolveConnectionStrings();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (connectionStrings.length === 0 && !accessToken) {
  const prompted = await promptForPassword();
  if (prompted?.trim()) {
    process.env.PROMPTED_DB_PASSWORD = prompted.trim();
    connectionStrings = resolveConnectionStrings();
  }
}

if (connectionStrings.length === 0 && !accessToken) {
  console.error(`
Missing database credentials for DDL migration.

Add one of these to .env.local, then run: npm run db:apply-elix-id

  SUPABASE_DB_PASSWORD=your-database-password
  POSTGRES_URL_NON_POOLING=postgresql://postgres.[ref]:[PASSWORD]@...supabase.com:5432/postgres
  SUPABASE_ACCESS_TOKEN=sbp_...   (from https://supabase.com/dashboard/account/tokens)

Database password: Supabase Dashboard → Project Settings → Database → Database password
(Not the sb_secret_ API key — that is different.)

Or paste supabase/migrations/010_patient_elix_id.sql into Supabase Dashboard → SQL Editor → Run.
`);
  process.exit(1);
}

try {
  if (connectionStrings.length > 0) {
    console.log('Using Postgres connection string…');
    await applyWithPg(connectionStrings);
  } else {
    console.log('Using Supabase Management API…');
    await applyWithManagementApi(accessToken);
  }
} catch (error) {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
}

if (!(await probeElixId())) {
  console.error('Migration ran but patients.elix_id is still missing. Check SQL errors above.');
  process.exit(1);
}

console.log('Done.');
await showSampleIds();
