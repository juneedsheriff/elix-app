/**
 * Applies 012_admins_list_policy.sql
 *   npm run db:apply-admin-policies
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(join(root, 'supabase/migrations/012_admins_list_policy.sql'), 'utf8');
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
const urls = [
  `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${pooler}-${region}.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`
];

let applied = false;
for (const connectionString of urls) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    applied = true;
    console.log('Applied 012_admins_list_policy.sql');
    break;
  } catch (error) {
    console.log('Try next connection:', error.message);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

if (!applied) process.exit(1);
