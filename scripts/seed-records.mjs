/**
 * Seeds demo uploaded_files (user_id null = shared demo pool for Get Opinion form).
 * Usage: same env vars as seed-doctors.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const records = [
  {
    file_name: 'MRI Brain Report.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 2457600,
    summary: 'Uploaded 12 mins ago • AI summary ready'
  },
  {
    file_name: 'Blood Panel - March 2026.jpg',
    mime_type: 'image/jpeg',
    file_size_bytes: 890000,
    summary: 'Uploaded 1 day ago • Translated to English'
  },
  {
    file_name: 'Cardiology Discharge Summary.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 512000,
    summary: 'Uploaded 1 week ago • Symptom extraction ready'
  },
  {
    file_name: 'Pathology Biopsy Report.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 1200000,
    summary: 'Uploaded 2 weeks ago • Shared with care team'
  }
];

const { count, error: countError } = await supabase
  .from('uploaded_files')
  .select('*', { count: 'exact', head: true })
  .is('user_id', null);

if (countError) {
  console.error('Cannot read uploaded_files:', countError.message);
  console.error('Run supabase/migrations/004_uploaded_files.sql or supabase/schema.sql first.');
  process.exit(1);
}

if (count && count >= records.length) {
  console.log(`Demo uploaded_files already seeded (${count} rows).`);
  process.exit(0);
}

if (count > 0) {
  await supabase.from('uploaded_files').delete().is('user_id', null);
}

const rows = records.map((r, i) => ({
  user_id: null,
  file_name: r.file_name,
  mime_type: r.mime_type,
  file_size_bytes: r.file_size_bytes,
  storage_bucket: 'medical-records',
  storage_path: `demo/${i + 1}-${r.file_name.replace(/[^\w.\-]+/g, '_')}`,
  summary: r.summary
}));

const { error } = await supabase.from('uploaded_files').insert(rows);

if (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}

console.log(`Seeded ${records.length} demo files in uploaded_files.`);
