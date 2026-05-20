/**
 * Assigns uploaded_files rows with no user_id to a specific auth user.
 *
 *   node scripts/assign-records-to-user.mjs [authUserId]
 *
 * Default auth user: 23a52a2e-c0c7-4847-8167-69110390f1ec
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

const authUserId = process.argv[2] ?? '23a52a2e-c0c7-4847-8167-69110390f1ec';
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: patient, error: patientError } = await supabase
  .from('patients')
  .select('id, full_name, email')
  .eq('auth_user_id', authUserId)
  .maybeSingle();

if (patientError) {
  console.error('Failed to load patient profile:', patientError.message);
  process.exit(1);
}

const { data: unassigned, error: listError } = await supabase
  .from('uploaded_files')
  .select('id, file_name')
  .is('user_id', null);

if (listError) {
  console.error('Failed to list uploaded_files:', listError.message);
  process.exit(1);
}

if (!unassigned?.length) {
  console.log('No uploaded_files rows with user_id = null.');
  process.exit(0);
}

console.log(`Assigning ${unassigned.length} file(s) to user ${authUserId}`);
for (const row of unassigned) {
  console.log(`  - ${row.file_name} (${row.id})`);
}

const patch = { user_id: authUserId };
if (patient?.id) {
  patch.patient_id = patient.id;
  console.log(`Linking patient_id: ${patient.id} (${patient.full_name ?? patient.email})`);
} else {
  console.warn('No patients row for this auth user; setting user_id only.');
}

const { data: updated, error: updateError } = await supabase
  .from('uploaded_files')
  .update(patch)
  .is('user_id', null)
  .select('id, file_name, user_id, patient_id');

if (updateError) {
  console.error('Update failed:', updateError.message);
  process.exit(1);
}

console.log(`Updated ${updated?.length ?? 0} row(s).`);
