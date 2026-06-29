/**
 * Upload RESEND_API_KEY from root .env.local to the elix-admin-auth worker.
 * Usage: node scripts/sync-admin-auth-resend-secret.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');

if (!existsSync(envPath)) {
  console.error('Missing .env.local');
  process.exit(1);
}

let apiKey = '';
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('RESEND_API_KEY=')) continue;
  apiKey = trimmed.slice('RESEND_API_KEY='.length).trim();
  if (
    (apiKey.startsWith('"') && apiKey.endsWith('"')) ||
    (apiKey.startsWith("'") && apiKey.endsWith("'"))
  ) {
    apiKey = apiKey.slice(1, -1);
  }
  break;
}

if (!apiKey) {
  console.error('RESEND_API_KEY is not set in .env.local');
  process.exit(1);
}

const workerDir = join(root, 'workers', 'admin-auth');
const result = spawnSync('npx', ['wrangler', 'secret', 'put', 'RESEND_API_KEY'], {
  cwd: workerDir,
  input: apiKey,
  encoding: 'utf8',
  shell: true
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('RESEND_API_KEY uploaded to elix-admin-auth worker.');
