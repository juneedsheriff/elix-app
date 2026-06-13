/**
 * Applies consultation_summaries_select_doctor policy (migration 040).
 *   npm run db:apply-consultation-summaries-select-doctor
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectRef = 'juwlzcxlekqttpdqqijv';
const migrationFile = '040_consultation_summaries_select_doctor.sql';

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

loadEnvFile('env.local');
loadEnvFile('.env.local');
loadEnvFile('.env.server.local');

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
    throw new Error(text || `Management API error (${response.status})`);
  }
  console.log(`Applied ${migrationFile} (Management API)`);
}

const connectionStrings = buildDbUrlsFromPassword();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (connectionStrings.length === 0 && !accessToken) {
  console.error('Missing SUPABASE_DB_PASSWORD or SUPABASE_ACCESS_TOKEN in env.local / .env.local');
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

console.log('Doctor SELECT policy on consultation_summaries applied successfully.');
