/**
 * Migrates file blobs from Supabase Storage (medical-records bucket) to Cloudflare R2.
 * Updates uploaded_files paths when normalizing to {userId}/... layout.
 *
 * Requires:
 *   - SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - wrangler logged in (`npx wrangler login`) for R2 uploads
 *
 * Usage:
 *   npm run db:migrate-records-to-r2
 *   node scripts/migrate-records-to-r2.mjs [--dry-run] [--delete-supabase] [--user=<authUserId>]
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { blobForRecord } from './lib/demo-file-blobs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const workerDir = join(root, 'workers/medical-records');
const SUPABASE_BUCKET = 'medical-records';
const R2_BUCKET = 'medical-records';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const deleteSupabase = args.includes('--delete-supabase');
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
  console.error(
    'Set SUPABASE_SERVICE_ROLE_KEY in .env.local or .env.server.local (Supabase Dashboard → Settings → API → service_role).'
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function storagePathFor(userId, record) {
  const safeName = (record.file_name ?? 'file').replace(/[^\w.\-() ]+/g, '_');
  return `${userId}/${record.id}-${safeName}`;
}

function resolveTargetPath(record) {
  const current = record.storage_path?.trim();
  if (!record.user_id) {
    return current || `demo/${record.id}-${(record.file_name ?? 'file').replace(/[^\w.\-() ]+/g, '_')}`;
  }

  const userPrefix = `${record.user_id}/`;
  const needsFix =
    !current?.startsWith(userPrefix) || current.includes('/demo/') || current.startsWith('demo/');

  if (needsFix) {
    return storagePathFor(record.user_id, record);
  }

  return current;
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
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

function r2ObjectPath(objectKey) {
  return `${R2_BUCKET}/${objectKey}`;
}

function r2ObjectExists(objectKey) {
  const cmd = `npx wrangler r2 object get ${quoteCmdArg(r2ObjectPath(objectKey))} --remote -p`;
  return runWranglerCmd(cmd, { silent: true });
}

function putR2Object(objectKey, buffer, contentType) {
  if (dryRun) return true;

  const tmp = join(tmpdir(), `r2-migrate-${randomUUID()}`);
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

async function downloadFromSupabase(path) {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function fetchAllRecords() {
  const pageSize = 500;
  let from = 0;
  const all = [];

  for (;;) {
    let query = supabase
      .from('uploaded_files')
      .select('id, user_id, file_name, mime_type, storage_path, storage_bucket, file_size_bytes')
      .order('uploaded_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (userFilter) {
      query = query.eq('user_id', userFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function loadBlob(record, targetPath) {
  const pathsToTry = [...new Set([record.storage_path, targetPath].filter(Boolean))];

  for (const path of pathsToTry) {
    const buffer = await downloadFromSupabase(path);
    if (buffer?.length) {
      return { buffer, source: `supabase:${path}` };
    }
  }

  const { buffer, contentType } = blobForRecord(record);
  return { buffer, contentType, source: 'demo-generator' };
}

console.log(
  `Migrate Supabase Storage → Cloudflare R2${dryRun ? ' (dry run)' : ''}${deleteSupabase ? ' + delete source' : ''}`
);
if (userFilter) console.log(`Filter: user_id = ${userFilter}`);

let records;
try {
  records = await fetchAllRecords();
} catch (error) {
  console.error('Failed to list uploaded_files:', error.message);
  process.exit(1);
}

if (!records.length) {
  console.log('No uploaded_files rows to migrate.');
  process.exit(0);
}

console.log(`Found ${records.length} row(s).`);

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
  const targetPath = resolveTargetPath(record);
  const contentType = record.mime_type || 'application/octet-stream';
  const label = record.file_name ?? record.id;

  if (r2ObjectExists(targetPath)) {
    const pathChanged = record.storage_path !== targetPath;
    if (pathChanged && !dryRun) {
      const { error: updateError } = await supabase
        .from('uploaded_files')
        .update({
          storage_path: targetPath,
          storage_bucket: R2_BUCKET,
          file_size_bytes: record.file_size_bytes || 0
        })
        .eq('id', record.id);

      if (updateError) {
        console.error(`DB update failed for ${label}:`, updateError.message);
        failed += 1;
        continue;
      }
      console.log(`OK (R2 exists, path updated): ${label} → ${targetPath}`);
    } else {
      console.log(`OK (already in R2): ${label}`);
    }
    skipped += 1;
    continue;
  }

  let blobResult;
  try {
    blobResult = await loadBlob(record, targetPath);
  } catch (error) {
    console.error(`Load failed for ${label}:`, error.message);
    failed += 1;
    continue;
  }

  const { buffer, source } = blobResult;
  const resolvedType = blobResult.contentType ?? contentType;

  if (!buffer?.length) {
    console.error(`No bytes for ${label} (${source})`);
    failed += 1;
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] Would migrate ${label}: ${source} → r2:${targetPath} (${buffer.length} bytes)`);
    migrated += 1;
    continue;
  }

  if (!putR2Object(targetPath, buffer, resolvedType)) {
    console.error(`R2 upload failed for ${label}`);
    failed += 1;
    continue;
  }

  const { error: updateError } = await supabase
    .from('uploaded_files')
    .update({
      storage_path: targetPath,
      storage_bucket: R2_BUCKET,
      mime_type: resolvedType,
      file_size_bytes: buffer.length
    })
    .eq('id', record.id);

  if (updateError) {
    console.error(`DB update failed for ${label}:`, updateError.message);
    failed += 1;
    continue;
  }

  if (deleteSupabase && record.storage_path && record.storage_path !== targetPath) {
    await supabase.storage.from(SUPABASE_BUCKET).remove([record.storage_path]);
  }
  if (deleteSupabase && record.storage_path === targetPath) {
    await supabase.storage.from(SUPABASE_BUCKET).remove([targetPath]);
  }

  console.log(`Migrated: ${label} (${source}) → r2:${targetPath} (${buffer.length} bytes)`);
  migrated += 1;
}

console.log(`Done. ${migrated} migrated, ${skipped} skipped, ${failed} failed.`);
