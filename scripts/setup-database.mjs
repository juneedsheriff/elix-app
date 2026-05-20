/**
 * Applies all SQL migrations to Supabase Postgres, then seeds data.
 *
 * Requires in .env.server.local (or environment):
 *   POSTGRES_URL_NON_POOLING  (direct connection, port 5432)
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (for seed scripts)
 *
 * Usage: npm run db:setup
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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
Missing database connection string.

Option A — SQL Editor (no local DB URL needed):
  1. Open Supabase Dashboard → SQL Editor
  2. Paste and run: supabase/schema.sql
  3. Then run: npm run db:seed && npm run db:seed-records

Option B — automated (add to .env.server.local):
  POSTGRES_URL_NON_POOLING=postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
  SUPABASE_URL=https://[ref].supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

  Find the URL under Project Settings → Database → Connection string → URI (Session mode / direct).
`);
  process.exit(1);
}

const migrationFiles = [
  '001_doctors.sql',
  '002_doctor_auth.sql',
  '002_opinion_requests.sql',
  '003_medical_records_storage.sql',
  '004_uploaded_files.sql',
  '005_patients.sql',
  '006_doctor_opinion_access.sql',
  '007_opinion_request_names.sql',
  '008_fix_opinion_doctor_id.sql',
  '009_opinion_doctor_response.sql'
];

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Connected to Postgres. Applying migrations…\n');

  for (const file of migrationFiles) {
    const path = join(root, 'supabase/migrations', file);
    const sql = readFileSync(path, 'utf8');
    await client.query(sql);
    console.log(`  ✓ ${file}`);
  }

  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('doctors', 'patients', 'uploaded_files', 'medical_records', 'opinion_requests', 'opinion_request_records')
    order by table_name
  `);

  console.log('\nPublic tables found:', rows.map((r) => r.table_name).join(', ') || '(none)');
} catch (error) {
  console.error('\nMigration failed:', error.message);
  console.error('\nFallback: run supabase/schema.sql in the Supabase SQL Editor.');
  process.exit(1);
} finally {
  await client.end();
}

console.log('\nRunning seed scripts…\n');

for (const script of ['seed-doctors.mjs', 'seed-records.mjs', 'seed-patients.mjs', 'seed-patient-auth.mjs']) {
  const result = spawnSync(process.execPath, [join(__dirname, script)], {
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    console.error(`Seed failed: ${script}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nDatabase setup complete.');
