/**
 * Adds doctor_response + responded_at to opinion_requests (migration 009).
 * Requires in .env.local or .env.server.local:
 *   POSTGRES_URL_NON_POOLING=postgres://postgres.[ref]:[PASSWORD]@...supabase.com:5432/postgres
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error(`
Missing POSTGRES_URL_NON_POOLING.

Add to .env.local (Supabase → Project Settings → Database → Connection string → URI, port 5432):
  POSTGRES_URL_NON_POOLING=postgres://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres

Or run supabase/apply-in-sql-editor.sql manually in SQL Editor.
`);
  process.exit(1);
}

const sql = readFileSync(join(root, 'supabase/migrations/009_opinion_doctor_response.sql'), 'utf8');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log('Added doctor_response and responded_at to opinion_requests.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
