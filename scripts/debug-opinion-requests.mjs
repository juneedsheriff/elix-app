/**
 * Debug opinion_requests visibility for doctors.
 * Usage: node scripts/debug-opinion-requests.mjs [doctorEmail]
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.argv[2] ?? 'dr.adebayo.okonkwo@elixapp.health';
const password = process.env.DOCTOR_DEFAULT_PASSWORD ?? 'Elix@123';

if (!url || !serviceKey || !anonKey) {
  console.error('Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: allRequests } = await admin.from('opinion_requests').select('id, doctor_id, doctor_name, patient_name, message');
console.log('\nAll opinion_requests (service role):');
console.table(allRequests ?? []);

let doctorQuery = admin.from('doctors').select('id, full_name, email, auth_user_id');
const { data: doctor } = email.includes('@')
  ? await doctorQuery.ilike('email', email).maybeSingle()
  : await doctorQuery.eq('id', email).maybeSingle();
console.log('\nDoctor row for', email);
console.log(doctor ?? 'NOT FOUND');

if (!doctor) process.exit(1);

const { count: byDoctorId } = await admin
  .from('opinion_requests')
  .select('*', { count: 'exact', head: true })
  .eq('doctor_id', doctor.id);
console.log('\nRequests with doctor_id = doctors.id:', byDoctorId);

const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email: doctor.email, password });
if (signInError) {
  console.error('\nDoctor sign-in failed:', signInError.message);
  console.error('Run: npm run db:seed-auth');
  process.exit(1);
}

const authed = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } }
});

const select = `
  id, doctor_id, doctor_name, patient_name, message,
  opinion_request_records ( uploaded_files ( id, file_name ) )
`;

const { data: asDoctor, error: doctorFetchError } = await authed
  .from('opinion_requests')
  .select(select)
  .eq('doctor_id', doctor.id);

console.log('\nFetch as doctor (client filter doctor_id):', doctorFetchError?.message ?? 'OK', 'rows:', asDoctor?.length ?? 0);

const { data: asDoctorRls, error: rlsError } = await authed.from('opinion_requests').select(select);

console.log('Fetch as doctor (RLS only, no filter):', rlsError?.message ?? 'OK', 'rows:', asDoctorRls?.length ?? 0);

if (doctorFetchError || rlsError) {
  console.log('\nIf permission denied on nested files, run migration 006_doctor_opinion_access.sql');
}

await anon.auth.signOut();
