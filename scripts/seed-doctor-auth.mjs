/**
 * Links each doctor to Supabase Auth with default password (Elix@123).
 * Sets email + phone on doctors rows. Safe to re-run (skips existing auth links).
 *
 *   $env:SUPABASE_URL="..."
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   npm run db:seed-auth
 */
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_DOCTOR_PASSWORD, doctorEmail, doctorPhone } from './doctor-credentials.mjs';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: doctors, error: listError } = await supabase
  .from('doctors')
  .select('id, full_name, email, phone, auth_user_id')
  .order('full_name');

if (listError) {
  console.error('Failed to list doctors:', listError.message);
  console.error('Run supabase/migrations/002_doctor_auth.sql first.');
  process.exit(1);
}

if (!doctors?.length) {
  console.error('No doctors found. Run npm run db:seed first.');
  process.exit(1);
}

let created = 0;
let updated = 0;
let skipped = 0;

for (let i = 0; i < doctors.length; i++) {
  const row = doctors[i];
  const email = row.email ?? doctorEmail(row.full_name, i);
  const phone = row.phone ?? doctorPhone(i);

  if (row.auth_user_id) {
    await supabase.from('doctors').update({ email, phone }).eq('id', row.id);
    skipped++;
    continue;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_DOCTOR_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: 'doctor',
      doctor_id: row.id,
      full_name: row.full_name
    }
  });

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        await supabase
          .from('doctors')
          .update({ email, phone, auth_user_id: existing.id })
          .eq('id', row.id);
        updated++;
        continue;
      }
    }
    console.error(`Auth failed for ${email}:`, authError.message);
    continue;
  }

  const authUserId = authData.user?.id;
  if (!authUserId) {
    console.error(`No user id returned for ${email}`);
    continue;
  }

  const { error: updateError } = await supabase
    .from('doctors')
    .update({ email, phone, auth_user_id: authUserId })
    .eq('id', row.id);

  if (updateError) {
    console.error(`Update failed for ${email}:`, updateError.message);
    await supabase.auth.admin.deleteUser(authUserId);
    continue;
  }

  created++;
}

console.log(`Doctor auth: ${created} created, ${updated} linked existing, ${skipped} already had auth.`);
console.log(`Default password for new accounts: ${DEFAULT_DOCTOR_PASSWORD}`);
