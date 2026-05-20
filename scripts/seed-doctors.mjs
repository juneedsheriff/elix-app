/**
 * Seeds up to 50 doctors into Supabase.
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://xxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
 *   node scripts/seed-doctors.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { doctorEmail, doctorPhone } from './doctor-credentials.mjs';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role, not anon).');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const specialties = [
  'Oncology',
  'Cardiology',
  'Neurology',
  'Endocrinology',
  'Dermatology',
  'Orthopedics',
  'Pediatrics',
  'Gastroenterology',
  'Pulmonology',
  'Nephrology',
  'Rheumatology',
  'Psychiatry',
  'Ophthalmology',
  'Urology',
  'Hematology'
];

const hospitals = [
  'Mayo Clinic',
  'Apollo Hospitals',
  'Johns Hopkins',
  'Cleveland Clinic',
  'Charité Berlin',
  'King\'s College Hospital',
  'Singapore General',
  'Mount Sinai',
  'Toronto General',
  'Royal Melbourne'
];

const countries = ['USA', 'India', 'UK', 'Germany', 'UAE', 'Canada', 'Australia', 'Singapore', 'France', 'Spain'];
const languageSets = [
  'English',
  'English/Spanish',
  'English/Hindi',
  'English/Arabic',
  'English/French',
  'English/Mandarin',
  'English/Portuguese',
  'English/German'
];

const firstNames = [
  'Sarah', 'Rajeev', 'Elena', 'James', 'Priya', 'Michael', 'Aisha', 'David', 'Mei', 'Carlos',
  'Fatima', 'Thomas', 'Yuki', 'Olivia', 'Ahmed', 'Sophie', 'Noah', 'Ananya', 'Lucas', 'Grace',
  'Omar', 'Emma', 'Daniel', 'Zara', 'Ethan', 'Nina', 'Benjamin', 'Leila', 'Henry', 'Maya',
  'William', 'Sofia', 'Alexander', 'Hana', 'Joseph', 'Chloe', 'Samuel', 'Riya', 'Matthew', 'Isabella',
  'Andrew', 'Amira', 'Christopher', 'Lin', 'Ryan', 'Victoria', 'Nathan', 'Kavya', 'Jonathan', 'Eva'
];

const lastNames = [
  'Mitchell', 'Nair', 'Rossi', 'Chen', 'Sharma', 'Brooks', 'Khan', 'Miller', 'Wong', 'Garcia',
  'Hassan', 'Anderson', 'Tanaka', 'Brown', 'Ali', 'Martin', 'Taylor', 'Patel', 'Silva', 'Lee',
  'Rahman', 'Wilson', 'Kim', 'Ibrahim', 'Moore', 'Kowalski', 'Clark', 'Nguyen', 'Walker', 'Das',
  'Hall', 'Romero', 'Young', 'Sato', 'King', 'Wright', 'Scott', 'Verma', 'Green', 'Bell',
  'Adams', 'Farah', 'Nelson', 'Zhou', 'Carter', 'Murphy', 'Roberts', 'Singh', 'Phillips', 'Costa'
];

function portraitUrl(index, gender) {
  const folder = gender === 'women' ? 'women' : 'men';
  return `https://randomuser.me/api/portraits/${folder}/${index % 99}.jpg`;
}

const doctors = Array.from({ length: 50 }, (_, i) => {
  const gender = i % 3 === 0 ? 'women' : 'men';
  const first = firstNames[i];
  const last = lastNames[i];
  const specialty = specialties[i % specialties.length];
  const hospital = hospitals[i % hospitals.length];
  const years = 8 + (i % 22);
  const rating = Number((4.5 + (i % 50) / 100).toFixed(2));
  const fee = 75 + (i % 18) * 5;

  const full_name = `Dr. ${first} ${last}`;

  return {
    full_name,
    email: doctorEmail(full_name, i),
    phone: doctorPhone(i),
    specialty,
    years_experience: years,
    hospital,
    rating: Math.min(rating, 5),
    languages: languageSets[i % languageSets.length],
    fee_usd: fee,
    image_url: portraitUrl(i + 10, gender),
    country: countries[i % countries.length],
    bio: `${specialty} specialist with ${years} years of experience at ${hospital}. Verified KYC, board-certified, and available for global second opinions.`
  };
});

// Table must exist — run supabase/migrations/001_doctors.sql in SQL Editor first
const { count, error: countError } = await supabase.from('doctors').select('*', { count: 'exact', head: true });

if (countError) {
  console.error('Cannot read doctors table:', countError.message);
  console.error('Run supabase/migrations/001_doctors.sql in Supabase SQL Editor first.');
  process.exit(1);
}

if (count && count >= 50) {
  console.log(`Doctors table already has ${count} rows. Skipping seed.`);
  process.exit(0);
}

if (count > 0) {
  await supabase.from('doctors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

const { error } = await supabase.from('doctors').insert(doctors);

if (error) {
  console.error('Seed failed:', error.message);
  console.error('Run supabase/migrations/001_doctors.sql in Supabase SQL Editor first.');
  process.exit(1);
}

console.log(`Seeded ${doctors.length} doctors successfully.`);
console.log('Run: npm run db:seed-auth  (creates login accounts, default password Elix@123)');
