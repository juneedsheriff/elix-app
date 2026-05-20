/**
 * Adds doctor_response columns via Supabase REST when Postgres URL is unavailable.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local or .env.server.local
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Probe: try select doctor_response
const probe = await supabase.from('opinion_requests').select('id, doctor_response, responded_at').limit(1);
if (!probe.error) {
  console.log('Columns doctor_response and responded_at already exist.');
  process.exit(0);
}

if (!probe.error.message.toLowerCase().includes('doctor_response')) {
  console.error('Unexpected error:', probe.error.message);
  process.exit(1);
}

console.log('Columns missing. Apply this SQL in Supabase Dashboard → SQL Editor:\n');
console.log(readFileSync(join(root, 'supabase/migrations/009_opinion_doctor_response.sql'), 'utf8'));
process.exit(1);
