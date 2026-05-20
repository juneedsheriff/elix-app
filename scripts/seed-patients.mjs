/**
 * Seeds demo patient profiles (no auth accounts — for Table Editor / testing).
 * Logged-in patients get a row via ensurePatientProfile on sign-up.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const demoPatients = [
  {
    full_name: 'Alex Morgan',
    email: 'alex.morgan@elixapp.health',
    phone: '+1-555-0201',
    country: 'USA',
    city: 'Boston',
    blood_group: 'O+',
    allergies: 'Penicillin',
    preferred_language: 'en'
  },
  {
    full_name: 'Priya Sharma',
    email: 'priya.sharma@elixapp.health',
    phone: '+91-98765-43210',
    country: 'India',
    city: 'Mumbai',
    blood_group: 'B+',
    preferred_language: 'en'
  },
  {
    full_name: 'James Okonkwo',
    email: 'james.okonkwo@elixapp.health',
    phone: '+44-20-7946-0958',
    country: 'UK',
    city: 'London',
    blood_group: 'A+',
    current_medications: 'Metformin 500mg',
    preferred_language: 'en'
  }
];

const { count, error: countError } = await supabase
  .from('patients')
  .select('*', { count: 'exact', head: true })
  .is('auth_user_id', null);

if (countError) {
  console.error('Cannot read patients:', countError.message);
  console.error('Run supabase/migrations/005_patients.sql first.');
  process.exit(1);
}

if (count && count >= demoPatients.length) {
  console.log(`Demo patients already seeded (${count} unlinked rows).`);
  process.exit(0);
}

const { error } = await supabase.from('patients').insert(
  demoPatients.map((p) => ({ ...p, auth_user_id: null }))
);

if (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}

console.log(`Seeded ${demoPatients.length} demo patient profiles.`);
console.log('Run: npm run db:seed-patient-auth  (email + password login, default Elix@123)');
