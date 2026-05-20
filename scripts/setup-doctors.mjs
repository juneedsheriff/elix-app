/** @deprecated Use npm run db:setup (setup-database.mjs) */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const result = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'setup-database.mjs')], {
  stdio: 'inherit',
  env: process.env
});
process.exit(result.status ?? 1);