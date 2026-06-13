/**
 * Applies opinion request audit table (038) and backfills existing requests (039).
 *   npm run db:apply-opinion-request-audit
 *   npm run db:apply-opinion-request-audit -- --backfill-only
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
const projectRef = 'juwlzcxlekqttpdqqijv';
const migrationFile = '038_opinion_request_audit.sql';
const backfillFile = '039_backfill_opinion_request_audit.sql';
const pseBackfillFile = '040_pse_audit_backfill.sql';
const backfillOnly = process.argv.includes('--backfill-only');
const pseBackfillOnly = process.argv.includes('--pse-backfill-only');

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

async function probeWithPg(connectionStrings) {
  if (!connectionStrings.length) return null;
  let lastError;
  for (const connectionString of connectionStrings) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      const table = await client.query(
        `select exists (
          select 1
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'opinion_request_audit_events'
        ) as exists`
      );
      const count = table.rows[0]?.exists
        ? await client.query('select count(*)::int as count from public.opinion_request_audit_events')
        : { rows: [{ count: 0 }] };
      return {
        tableExists: Boolean(table.rows[0]?.exists),
        eventCount: Number(count.rows[0]?.count ?? 0)
      };
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
  if (lastError) throw lastError;
  return null;
}

async function probeWithServiceRole() {
  if (!supabaseUrl || !serviceKey) return null;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const probe = await supabase.from('opinion_request_audit_events').select('id', { count: 'exact', head: true });
  if (probe.error) return { tableExists: false, eventCount: 0 };
  return { tableExists: true, eventCount: probe.count ?? 0 };
}

async function probeApplied(connectionStrings) {
  const pgProbe = await probeWithPg(connectionStrings);
  if (pgProbe) return pgProbe;
  return probeWithServiceRole();
}

async function applyWithPg(connectionStrings, sql, label) {
  let lastError;
  for (const connectionString of connectionStrings) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      console.log(`Applied ${label}`);
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

async function applyWithManagementApi(accessToken, sql, label) {
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
  console.log(`Applied ${label} (Management API)`);
}

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

Add one of these to .env.local, then run: npm run db:apply-opinion-request-audit

  SUPABASE_DB_PASSWORD=your-database-password
  SUPABASE_ACCESS_TOKEN=sbp_...   (https://supabase.com/dashboard/account/tokens)

Or paste supabase/migrations/038_opinion_request_audit.sql and 039_backfill_opinion_request_audit.sql
into Supabase Dashboard → SQL Editor → Run.
`);
  process.exit(1);
}

const before = await probeApplied(connectionStrings);

if (!backfillOnly && !pseBackfillOnly) {
  if (before?.tableExists) {
    console.log('Opinion request audit table already exists.');
  } else {
    console.log('Applying opinion request audit migration (038)…');
    const sql = readFileSync(join(root, 'supabase/migrations', migrationFile), 'utf8');
    try {
      if (connectionStrings.length > 0) {
        await applyWithPg(connectionStrings, sql, migrationFile);
      } else {
        await applyWithManagementApi(accessToken, sql, migrationFile);
      }
    } catch (error) {
      console.error(`Failed ${migrationFile}:`, error.message);
      process.exit(1);
    }
  }
} else if (backfillOnly) {
  console.log('Running general backfill only (039)…');
} else {
  console.log('Running PSE backfill only (040)…');
}

if (!pseBackfillOnly) {
  console.log('Backfilling activity history for existing requests (039)…');
  const backfillSql = readFileSync(join(root, 'supabase/migrations', backfillFile), 'utf8');
  try {
    if (connectionStrings.length > 0) {
      await applyWithPg(connectionStrings, backfillSql, backfillFile);
    } else {
      await applyWithManagementApi(accessToken, backfillSql, backfillFile);
    }
  } catch (error) {
    console.error(`Failed ${backfillFile}:`, error.message);
    process.exit(1);
  }
}

console.log('Backfilling PSE activity history (040)…');
const pseBackfillSql = readFileSync(join(root, 'supabase/migrations', pseBackfillFile), 'utf8');
try {
  if (connectionStrings.length > 0) {
    await applyWithPg(connectionStrings, pseBackfillSql, pseBackfillFile);
  } else {
    await applyWithManagementApi(accessToken, pseBackfillSql, pseBackfillFile);
  }
} catch (error) {
  console.error(`Failed ${pseBackfillFile}:`, error.message);
  process.exit(1);
}

const after = await probeApplied(connectionStrings);
if (!after?.tableExists) {
  console.error('Migration ran but opinion_request_audit_events is still missing.');
  process.exit(1);
}

console.log(
  `Opinion request audit ready. ${after.eventCount} activity event${after.eventCount === 1 ? '' : 's'} in the database.`
);
