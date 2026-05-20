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

loadEnvFile('.env.local');

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const patientEmail = process.argv[2] ?? 'jsskmd@gmail.com';
const password = process.env.DOCTOR_DEFAULT_PASSWORD ?? 'Elix@123';

const admin = serviceKey ? createClient(url, serviceKey) : null;
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

if (admin) {
  const { data } = await admin.from('opinion_requests').select('id, patient_id, patient_name, status, doctor_response, created_at');
  console.log('All requests (service):');
  console.table(data ?? []);
}

const { data: signIn, error } = await anon.auth.signInWithPassword({ email: patientEmail, password });
if (error) {
  console.error('Sign-in failed:', error.message);
  process.exit(1);
}
console.log('\nPatient auth uid:', signIn.user.id);

const authed = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
});

const select =
  'id, patient_id, status, doctor_response, created_at, doctors ( id, full_name )';

const { data: filtered, error: fErr } = await authed
  .from('opinion_requests')
  .select(select)
  .eq('patient_id', signIn.user.id);

console.log('\nFiltered by patient_id = auth.uid:', fErr?.message ?? 'OK', filtered?.length ?? 0);
console.table(filtered ?? []);

const { data: allVisible, error: aErr } = await authed.from('opinion_requests').select(select);
console.log('\nRLS only (no patient filter):', aErr?.message ?? 'OK', allVisible?.length ?? 0);
console.table(allVisible ?? []);
