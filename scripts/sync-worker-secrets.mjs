/**
 * Sync Supabase keys to Cloudflare medical-records worker secrets.
 * Reads env.local / .env.local — never commit those files.
 *   node scripts/sync-worker-secrets.mjs
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const workerDir = join(root, 'workers', 'medical-records');

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

const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!anonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY in env.local / .env.local');
  process.exit(1);
}

function putSecret(name, value) {
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    cwd: workerDir,
    input: value,
    encoding: 'utf8',
    shell: true
  });
  if (result.status !== 0) {
    console.error(`Failed to set ${name}:`, result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  console.log(`Set worker secret: ${name}`);
}

putSecret('SUPABASE_ANON_KEY', anonKey);
if (serviceKey) {
  putSecret('SUPABASE_SERVICE_ROLE_KEY', serviceKey);
} else {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not set — skipping (doctor upload auth may be limited).');
}

const devVarsPath = join(workerDir, '.dev.vars');
writeFileSync(
  devVarsPath,
  `SUPABASE_ANON_KEY=${anonKey}\n${serviceKey ? `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}\n` : ''}`,
  'utf8'
);
console.log(`Wrote ${devVarsPath} for local worker dev.`);
