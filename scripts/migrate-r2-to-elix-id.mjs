/**
 * Moves existing Cloudflare R2 objects from {auth_user_id}/ to {elix_id}/ and
 * updates uploaded_files.storage_path.
 *
 * Requires:
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - wrangler logged in (`npx wrangler login`) for R2 access
 *
 * Usage:
 *   npm run db:migrate-r2-to-elix-id
 *   node scripts/migrate-r2-to-elix-id.mjs [--dry-run] [--delete-old] [--user=<authUserId>]
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const workerDir = join(root, 'workers/medical-records');
const R2_BUCKET = 'medical-records';
const ELIX_ID_PATTERN = /^elix-[a-z]{2}[0-9]{4}$/;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const deleteOld = args.includes('--delete-old');
const userFilter = args.find((a) => a.startsWith('--user='))?.slice('--user='.length);

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

if (!url || !key?.trim()) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local or .env.server.local.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function r2ObjectPath(objectKey) {
  return `${R2_BUCKET}/${objectKey}`;
}

function runWranglerCmd(command, { silent = false } = {}) {
  const result = spawnSync(command, {
    cwd: workerDir,
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
    stdio: silent ? ['pipe', 'pipe', 'pipe'] : 'inherit'
  });
  return result.status === 0;
}

function r2ObjectExists(objectKey) {
  const cmd = `npx wrangler r2 object get ${quoteCmdArg(r2ObjectPath(objectKey))} --remote -p`;
  return runWranglerCmd(cmd, { silent: true });
}

function getR2ObjectBuffer(objectKey) {
  const tmp = join(tmpdir(), `r2-get-${randomUUID()}`);
  const cmd = [
    'npx wrangler r2 object get',
    quoteCmdArg(r2ObjectPath(objectKey)),
    '--file',
    quoteCmdArg(tmp),
    '--remote'
  ].join(' ');

  if (!runWranglerCmd(cmd, { silent: true })) return null;

  try {
    return readFileSync(tmp);
  } catch {
    return null;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function putR2Object(objectKey, buffer, contentType) {
  if (dryRun) return true;

  const tmp = join(tmpdir(), `r2-put-${randomUUID()}`);
  writeFileSync(tmp, buffer);
  try {
    const cmd = [
      'npx wrangler r2 object put',
      quoteCmdArg(r2ObjectPath(objectKey)),
      '--file',
      quoteCmdArg(tmp),
      '--remote',
      '--content-type',
      quoteCmdArg(contentType)
    ].join(' ');
    return runWranglerCmd(cmd);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function deleteR2Object(objectKey) {
  if (dryRun) return true;
  const cmd = `npx wrangler r2 object delete ${quoteCmdArg(r2ObjectPath(objectKey))} --remote`;
  return runWranglerCmd(cmd, { silent: true });
}

async function fetchElixIdByAuthUser() {
  const { data, error } = await supabase
    .from('patients')
    .select('auth_user_id, elix_id')
    .not('auth_user_id', 'is', null)
    .not('elix_id', 'is', null);

  if (error) throw new Error(error.message);

  const map = new Map();
  for (const row of data ?? []) {
    const authUserId = row.auth_user_id?.trim();
    const elixId = row.elix_id?.trim();
    if (!authUserId || !elixId || !ELIX_ID_PATTERN.test(elixId)) continue;
    map.set(authUserId, elixId);
  }
  return map;
}

async function fetchAllRecords() {
  const pageSize = 500;
  let from = 0;
  const all = [];

  for (;;) {
    let query = supabase
      .from('uploaded_files')
      .select('id, user_id, file_name, mime_type, storage_path, storage_bucket')
      .not('user_id', 'is', null)
      .order('uploaded_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (userFilter) {
      query = query.eq('user_id', userFilter);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function resolveElixTargetPath(record, elixByUserId) {
  const current = record.storage_path?.trim();
  const userId = record.user_id?.trim();
  if (!current || !userId) return null;

  const elixId = elixByUserId.get(userId);
  if (!elixId) return null;

  if (current.startsWith(`${elixId}/`)) return null;

  const userPrefix = `${userId}/`;
  if (!current.startsWith(userPrefix)) return null;

  return `${elixId}/${current.slice(userPrefix.length)}`;
}

console.log(
  `Migrate R2 folders → elix_id${dryRun ? ' (dry run)' : ''}${deleteOld ? ' + delete old keys' : ''}`
);
if (userFilter) console.log(`Filter: user_id = ${userFilter}`);

let elixByUserId;
try {
  elixByUserId = await fetchElixIdByAuthUser();
} catch (error) {
  console.error('Failed to load patients:', error.message);
  process.exit(1);
}

console.log(`Loaded ${elixByUserId.size} patient elix_id mapping(s).`);

let records;
try {
  records = await fetchAllRecords();
} catch (error) {
  console.error('Failed to list uploaded_files:', error.message);
  process.exit(1);
}

if (!records.length) {
  console.log('No uploaded_files rows with user_id.');
  process.exit(0);
}

try {
  execSync('npx wrangler --version', { cwd: workerDir, stdio: 'pipe', shell: true, windowsHide: true });
} catch {
  console.error('Wrangler not available. Run: cd workers/medical-records && npm install');
  process.exit(1);
}

let migrated = 0;
let skipped = 0;
let failed = 0;

for (const record of records) {
  const label = record.file_name ?? record.id;
  const targetPath = resolveElixTargetPath(record, elixByUserId);

  if (!targetPath) {
    skipped += 1;
    continue;
  }

  const sourcePath = record.storage_path.trim();
  const contentType = record.mime_type || 'application/octet-stream';

  if (r2ObjectExists(targetPath)) {
    if (record.storage_path !== targetPath && !dryRun) {
      const { error: updateError } = await supabase
        .from('uploaded_files')
        .update({ storage_path: targetPath, storage_bucket: R2_BUCKET })
        .eq('id', record.id);

      if (updateError) {
        console.error(`DB update failed for ${label}:`, updateError.message);
        failed += 1;
        continue;
      }
      console.log(`OK (target exists, DB updated): ${sourcePath} → ${targetPath}`);
    } else {
      console.log(`OK (already at elix path): ${targetPath}`);
    }
    skipped += 1;
    continue;
  }

  let buffer = null;
  if (r2ObjectExists(sourcePath)) {
    buffer = getR2ObjectBuffer(sourcePath);
  }

  if (!buffer?.length) {
    console.error(`Skip (source missing in R2): ${label} @ ${sourcePath}`);
    failed += 1;
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] Would move ${label}: ${sourcePath} → ${targetPath} (${buffer.length} bytes)`);
    migrated += 1;
    continue;
  }

  if (!putR2Object(targetPath, buffer, contentType)) {
    console.error(`R2 put failed for ${label} → ${targetPath}`);
    failed += 1;
    continue;
  }

  const { error: updateError } = await supabase
    .from('uploaded_files')
    .update({ storage_path: targetPath, storage_bucket: R2_BUCKET })
    .eq('id', record.id);

  if (updateError) {
    console.error(`DB update failed for ${label}:`, updateError.message);
    failed += 1;
    continue;
  }

  if (deleteOld && sourcePath !== targetPath) {
    deleteR2Object(sourcePath);
  }

  console.log(`Moved: ${label} ${sourcePath} → ${targetPath} (${buffer.length} bytes)`);
  migrated += 1;
}

console.log(`Done. ${migrated} migrated, ${skipped} skipped, ${failed} failed.`);
