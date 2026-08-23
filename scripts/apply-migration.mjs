/**
 * Apply a single SQL migration file.
 * Usage: node scripts/apply-migration.mjs 007_opinion_request_names.sql
 *
 * Connection (first match wins across candidates):
 *   POSTGRES_URL_NON_POOLING / POSTGRES_URL / DATABASE_URL
 *   or SUPABASE_DB_PASSWORD (+ project ref from SUPABASE_URL)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const defaultProjectRef = 'juwlzcxlekqttpdqqijv';

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

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-migration.mjs <migration-file.sql>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

function buildDbUrls() {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const urls = [
    process.env.POSTGRES_URL_NON_POOLING?.trim(),
    process.env.POSTGRES_URL?.trim(),
    process.env.DATABASE_URL?.trim()
  ].filter(Boolean);

  if (password) {
    const ref =
      process.env.SUPABASE_PROJECT_REF?.trim() ||
      supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ||
      defaultProjectRef;
    const region = process.env.SUPABASE_DB_REGION?.trim() || 'us-east-1';
    const pooler = process.env.SUPABASE_DB_POOLER?.trim() || 'aws-1';
    const encoded = encodeURIComponent(password);
    urls.push(
      `postgresql://postgres.${ref}:${encoded}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`
    );
  }

  return [...new Set(urls)];
}

const connectionStrings = buildDbUrls();
if (connectionStrings.length === 0) {
  console.error(
    'Set POSTGRES_URL_NON_POOLING, POSTGRES_URL, or SUPABASE_DB_PASSWORD in .env.server.local / .env.local'
  );
  process.exit(1);
}

const sql = readFileSync(join(root, 'supabase/migrations', file), 'utf8');

function isConnectionError(err) {
  const msg = err?.message ?? String(err);
  const code = err?.code ?? '';
  return (
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|connect/i.test(msg) ||
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EAI_AGAIN/.test(code)
  );
}

let lastError;
for (const connectionString of connectionStrings) {
  const host = connectionString.replace(/\/\/([^@/]+)@/, '//***@');
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    console.log(`Applied ${file}`);
    process.exit(0);
  } catch (err) {
    lastError = err;
    if (!isConnectionError(err)) {
      console.error(`Failed via ${host}: ${err?.message ?? err}`);
      process.exit(1);
    }
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

console.error(lastError?.message ?? 'Could not connect to Postgres');
process.exit(1);
