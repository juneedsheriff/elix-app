import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './admin-credentials.mjs';
import { PSE_EMAIL, PSE_PASSWORD } from './pse-credentials.mjs';
import { DEFAULT_PATIENT_PASSWORD } from './patient-credentials.mjs';

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile('.env.server.local');
loadEnvFile('.env.local');

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_AUTH_URL = (process.env.VITE_ADMIN_AUTH_API_URL ?? '').replace(/\/$/, '');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !ADMIN_AUTH_URL) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_AUTH_API_URL');
  process.exit(1);
}

const requestIdArg = process.argv[2]?.trim() || null;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function resolveRequestId() {
  if (requestIdArg) return requestIdArg;
  const { data, error } = await admin
    .from('opinion_requests')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) {
    throw new Error(`Could not resolve latest request id: ${error?.message ?? 'not found'}`);
  }
  return data.id;
}

async function loadContext(requestId) {
  const { data, error } = await admin
    .from('opinion_requests')
    .select(
      'id, patient_id, assigned_to, doctor_id, patient_name, doctor_name, assignee:admins!opinion_requests_assigned_to_fkey(email), doctor_profile:doctors!opinion_requests_doctor_id_fkey(email)'
    )
    .eq('id', requestId)
    .maybeSingle();
  if (error || !data) throw new Error(`Could not load request context: ${error?.message ?? 'not found'}`);

  let patientEmail = '';
  if (data.patient_id) {
    const { data: patient } = await admin
      .from('patients')
      .select('email')
      .eq('auth_user_id', data.patient_id)
      .maybeSingle();
    patientEmail = (patient?.email ?? '').trim();
  }

  return {
    requestId: data.id,
    patientId: data.patient_id ?? null,
    patientEmail: patientEmail || null,
    assignedTo: data.assigned_to ?? null,
    pseEmail: data.assignee?.email ?? null,
    doctorId: data.doctor_id ?? null,
    doctorEmail: data.doctor_profile?.email ?? null
  };
}

async function signIn(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    throw new Error(`${email}: sign-in failed (${error?.message ?? 'no session'})`);
  }
  return data.session.access_token;
}

async function postLifecycle(event, requestId, token) {
  const response = await fetch(`${ADMIN_AUTH_URL}/notify/request-lifecycle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ event, requestId })
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body };
}

const requestId = await resolveRequestId();
const ctx = await loadContext(requestId);

console.log('Testing request lifecycle email notifications');
console.log('Request context:', ctx);

const checks = [];

if (ctx.patientEmail) {
  checks.push({
    name: 'patient_request_submitted',
    actorEmail: ctx.patientEmail,
    actorPassword: DEFAULT_PATIENT_PASSWORD
  });
} else {
  console.log('SKIP patient_request_submitted: patient email not found.');
}

checks.push({
  name: 'request_assigned_to_pse',
  actorEmail: ADMIN_EMAIL,
  actorPassword: ADMIN_PASSWORD
});

checks.push({
  name: 'request_released_to_doctor',
  actorEmail: PSE_EMAIL,
  actorPassword: PSE_PASSWORD
});

for (const check of checks) {
  try {
    const token = await signIn(check.actorEmail, check.actorPassword);
    const result = await postLifecycle(check.name, requestId, token);
    console.log(`\n[${check.name}] actor=${check.actorEmail}`);
    console.log('status:', result.status, 'ok:', result.ok);
    console.log('body:', JSON.stringify(result.body));
  } catch (error) {
    console.log(`\n[${check.name}] actor=${check.actorEmail}`);
    console.log('ERROR:', error instanceof Error ? error.message : String(error));
  }
}

await anon.auth.signOut();
