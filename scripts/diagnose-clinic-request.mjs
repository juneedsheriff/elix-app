import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.local');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const patientFilter = process.argv[2] ?? 'yousuf';

const { data: reqs } = await admin
  .from('opinion_requests')
  .select(
    'id, patient_name, patient_email, assigned_to, consultation_stage, clinic_id, status, created_at'
  )
  .or(`patient_name.ilike.%${patientFilter}%,patient_email.ilike.%${patientFilter}%`)
  .order('created_at', { ascending: false })
  .limit(10);

const { data: pseList } = await admin
  .from('admins')
  .select('id, full_name, email, role, clinic_id')
  .eq('role', 'patient_service_executive_clinic');

console.log(JSON.stringify({ clinicPse: pseList, requests: reqs }, null, 2));
