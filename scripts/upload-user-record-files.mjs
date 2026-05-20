/**
 * Uploads real blobs to Storage for uploaded_files rows (fixes "Object not found").
 * Moves demo/* paths to {authUserId}/{id}-{fileName} so Storage RLS allows patient access.
 *
 *   npm run db:upload-record-files
 *   node scripts/upload-user-record-files.mjs [authUserId]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { blobForRecord } from './lib/demo-file-blobs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const BUCKET = 'medical-records';

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

const authUserId = process.argv[2] ?? '23a52a2e-c0c7-4847-8167-69110390f1ec';
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function storagePathFor(userId, record) {
  const safeName = (record.file_name ?? 'file').replace(/[^\w.\-() ]+/g, '_');
  return `${userId}/${record.id}-${safeName}`;
}

async function objectExists(path) {
  const { error } = await supabase.storage.from(BUCKET).download(path);
  return !error;
}

const { data: records, error: listError } = await supabase
  .from('uploaded_files')
  .select('id, file_name, mime_type, storage_path, user_id')
  .eq('user_id', authUserId);

if (listError) {
  console.error('Failed to list uploaded_files:', listError.message);
  process.exit(1);
}

if (!records?.length) {
  console.log(`No uploaded_files for user ${authUserId}.`);
  process.exit(0);
}

let uploaded = 0;
let skipped = 0;

for (const record of records) {
  const userPrefix = `${authUserId}/`;
  let targetPath = record.storage_path;
  const needsPathFix =
    !targetPath?.startsWith(userPrefix) ||
    targetPath.includes('/demo/') ||
    targetPath.startsWith('demo/');
  if (needsPathFix) {
    targetPath = storagePathFor(authUserId, record);
  }

  const exists = await objectExists(targetPath);
  if (exists && !needsPathFix) {
    console.log(`OK (already in storage): ${record.file_name}`);
    skipped += 1;
    continue;
  }

  const { buffer, contentType } = blobForRecord(record);
  const oldPath = record.storage_path;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(targetPath, buffer, {
    contentType,
    upsert: true
  });

  if (uploadError) {
    console.error(`Upload failed for ${record.file_name}:`, uploadError.message);
    continue;
  }

  const { error: updateError } = await supabase
    .from('uploaded_files')
    .update({
      storage_path: targetPath,
      storage_bucket: BUCKET,
      mime_type: contentType,
      file_size_bytes: buffer.length
    })
    .eq('id', record.id);

  if (updateError) {
    console.error(`DB update failed for ${record.file_name}:`, updateError.message);
    continue;
  }

  if (oldPath && oldPath !== targetPath && oldPath.startsWith('demo/')) {
    await supabase.storage.from(BUCKET).remove([oldPath]);
  }

  console.log(`Uploaded: ${record.file_name} → ${targetPath} (${buffer.length} bytes)`);
  uploaded += 1;
}

console.log(`Done. ${uploaded} uploaded, ${skipped} already present.`);
