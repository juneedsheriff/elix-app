/**
 * Enables Supabase Realtime for clinic doctor workspace changes (migration 055).
 *   npm run db:apply-clinic-doctors-realtime
 *   npm run db:apply-clinic-doctors-realtime -- --password=YOUR_DB_PASSWORD
 */
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
const migrationFile = '055_clinic_doctors_realtime.sql';
const REALTIME_TABLES = ['clinic_doctor_grants', 'doctors'];

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

function readPasswordFromArgs() {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--password=')) return arg.slice('--password='.length);
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
    process.env.POSTGRES_URL_NON_POOLING?.trim(),
    process.env.POSTGRES_URL?.trim(),
    process.env.DATABASE_URL?.trim(),
    `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`
  ].filter(Boolean);
}

async function probeRealtimeEnabled(client) {
  const { rows } = await client.query(
    `
    select tablename
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = any($1::text[])
    `,
    [REALTIME_TABLES]
  );
  const found = new Set(rows.map((row) => row.tablename));
  return REALTIME_TABLES.every((table) => found.has(table));
}

async function applyWithPg(connectionStrings, sql) {
  let lastError;
  for (const connectionString of connectionStrings) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      if (await probeRealtimeEnabled(client)) {
        console.log('Clinic doctors Realtime is already enabled.');
        return true;
      }
      await client.query(sql);
      if (!(await probeRealtimeEnabled(client))) {
        throw new Error('Migration ran but Realtime tables are still missing from supabase_realtime publication.');
      }
      console.log(`Applied ${migrationFile}`);
      return true;
    } catch (error) {
      if (error.message?.includes('already member of publication')) {
        console.log('Realtime publication entries already exist.');
        return true;
      }
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

async function applyWithManagementApi(accessToken, sql) {
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
    if (text.includes('already member of publication')) {
      console.log('Realtime publication entries already exist.');
      return;
    }
    throw new Error(text || `Management API error (${response.status})`);
  }
  console.log(`Applied ${migrationFile} (Management API)`);
}

console.log('Enabling Realtime for clinic doctor workspace (055)…');

let connectionStrings = buildDbUrlsFromPassword();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (connectionStrings.length === 0 && !accessToken) {
  const prompted = await promptForPassword();
  if (prompted?.trim()) {
    process.env.PROMPTED_DB_PASSWORD = prompted.trim();
    connectionStrings = buildDbUrlsFromPassword();
  }
}

if (connectionStrings.length === 0 && !accessToken) {
  console.error(`
Missing database credentials for DDL migration.

Add one of these to .env.local, then run: npm run db:apply-clinic-doctors-realtime

  SUPABASE_DB_PASSWORD=your-database-password
  SUPABASE_ACCESS_TOKEN=sbp_...   (https://supabase.com/dashboard/account/tokens)

Or paste supabase/migrations/${migrationFile} into Supabase Dashboard → SQL Editor → Run.
`);
  process.exit(1);
}

const sql = readFileSync(join(root, 'supabase/migrations', migrationFile), 'utf8');

try {
  if (connectionStrings.length > 0) {
    await applyWithPg(connectionStrings, sql);
  } else {
    await applyWithManagementApi(accessToken, sql);
  }
} catch (error) {
  console.error(`Failed ${migrationFile}:`, error.message);
  process.exit(1);
}

console.log('Realtime enabled for clinic_doctor_grants and doctors.');
