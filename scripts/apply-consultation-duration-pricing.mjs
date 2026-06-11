/**
 * Applies consultation duration pricing (migration 034).
 *   npm run db:apply-consultation-duration-pricing
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
const migrationFile = '034_consultation_duration_pricing.sql';

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

async function probeApplied() {
  if (!supabaseUrl || !serviceKey) return false;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const probe = await supabase.from('doctors').select('consultation_tiers').limit(1);
  return !probe.error;
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
    process.env.POSTGRES_URL_NON_POOLING?.trim(),
    process.env.POSTGRES_URL?.trim(),
    process.env.DATABASE_URL?.trim(),
    `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`
  ].filter(Boolean);
}

async function applyWithPg(connectionStrings, sql) {
  let lastError;
  for (const connectionString of connectionStrings) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      console.log(`Applied ${migrationFile}`);
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

if (await probeApplied()) {
  console.log('Consultation duration pricing migration already applied.');
  process.exit(0);
}

console.log('Applying consultation duration pricing migration (034)…');

const connectionStrings = buildDbUrlsFromPassword();
if (connectionStrings.length === 0) {
  console.error(`
Missing SUPABASE_DB_PASSWORD. Set it in .env.local, or paste
supabase/migrations/${migrationFile} into the Supabase SQL Editor.
`);
  process.exit(1);
}

const sql = readFileSync(join(root, 'supabase/migrations', migrationFile), 'utf8');

try {
  await applyWithPg(connectionStrings, sql);
} catch (error) {
  console.error(`Failed ${migrationFile}:`, error.message);
  process.exit(1);
}

if (!(await probeApplied())) {
  console.error('Migration ran but doctors.consultation_tiers may still be missing.');
  process.exit(1);
}

console.log('Consultation duration pricing migration applied successfully.');
