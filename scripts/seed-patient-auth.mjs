/**
 * Creates Supabase Auth logins for patients (default password Elix@123).
 * Links auth_user_id on public.patients. Safe to re-run.
 *
 *   npm run db:seed-patient-auth
 */
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PATIENT_PASSWORD } from './patient-credentials.mjs';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: patients, error: listError } = await supabase
  .from('patients')
  .select('id, full_name, email, phone, auth_user_id')
  .order('full_name');

if (listError) {
  console.error('Failed to list patients:', listError.message);
  console.error('Run supabase/migrations/005_patients.sql and npm run db:seed-patients first.');
  process.exit(1);
}

if (!patients?.length) {
  console.error('No patients found. Run: npm run db:seed-patients');
  process.exit(1);
}

let created = 0;
let linked = 0;
let skipped = 0;

for (const row of patients) {
  const email = row.email?.trim().toLowerCase();
  if (!email) continue;

  if (row.auth_user_id) {
    skipped++;
    continue;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PATIENT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: 'patient',
      patient_id: row.id,
      full_name: row.full_name
    }
  });

  let authUserId = authData.user?.id;

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);
      if (existing) {
        authUserId = existing.id;
        linked++;
      } else {
        console.error(`Auth failed for ${email}:`, authError.message);
        continue;
      }
    } else {
      console.error(`Auth failed for ${email}:`, authError.message);
      continue;
    }
  } else {
    created++;
  }

  if (!authUserId) continue;

  const { error: updateError } = await supabase
    .from('patients')
    .update({ auth_user_id: authUserId })
    .eq('id', row.id);

  if (updateError) {
    console.error(`Link failed for ${email}:`, updateError.message);
    if (authError === undefined && created > 0) {
      await supabase.auth.admin.deleteUser(authUserId);
    }
  }
}

console.log(`Patient auth: ${created} created, ${linked} linked existing, ${skipped} already had login.`);
console.log(`Default password: ${DEFAULT_PATIENT_PASSWORD}`);
console.log('Example: alex.morgan@elixapp.health / Elix@123');
