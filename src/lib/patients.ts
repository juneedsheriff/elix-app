import type { User } from '@supabase/supabase-js';
import type { Patient, PatientUpsertInput } from '../types/patient';
import { supabase } from './supabase';

const patientColumnsWithElix =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, created_at, updated_at';

const patientColumnsLegacy =
  'id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, created_at, updated_at';

function withFallbackElixId(patient: Patient | null): Patient | null {
  if (!patient || patient.elix_id) return patient;
  const suffix = patient.id.replace(/-/g, '').slice(0, 6).toLowerCase();
  return { ...patient, elix_id: `elix-${suffix.padEnd(6, '0').slice(0, 6)}` };
}

async function selectPatient(
  build: (columns: string) => ReturnType<typeof supabase.from<'patients'>>
) {
  const withElix = await build(patientColumnsWithElix).maybeSingle();
  if (!withElix.error) {
    return { data: withFallbackElixId(withElix.data as Patient | null), error: null };
  }
  if (!withElix.error.message.includes('elix_id')) {
    return { data: null, error: withElix.error };
  }

  const legacy = await build(patientColumnsLegacy).maybeSingle();
  if (legacy.error) return { data: null, error: legacy.error };
  return { data: withFallbackElixId(legacy.data as Patient | null), error: null };
}

export async function fetchPatientByAuthUserId(authUserId: string) {
  return selectPatient((columns) =>
    supabase.from('patients').select(columns).eq('auth_user_id', authUserId)
  );
}

export async function fetchPatientByEmail(email: string) {
  return selectPatient((columns) => supabase.from('patients').select(columns).ilike('email', email.trim()));
}

export async function fetchPatientById(id: string) {
  return selectPatient((columns) => supabase.from('patients').select(columns).eq('id', id));
}

export function defaultPatientNameFromUser(user: User): string {
  const meta = user.user_metadata?.full_name;
  if (typeof meta === 'string' && meta.trim()) return meta.trim();
  const local = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Patient';
}

/** Attach auth login to an existing patients row (e.g. demo seed) or insert a new profile. */
export async function ensurePatientProfile(user: User, input?: Partial<PatientUpsertInput>) {
  const byAuth = await fetchPatientByAuthUserId(user.id);
  if (byAuth.data) return { data: byAuth.data, error: null, created: false };
  if (byAuth.error) return { data: null, error: byAuth.error, created: false };

  if (!user.email) {
    return { data: null, error: { message: 'User email is required for patient profile.' }, created: false };
  }

  const email = (input?.email ?? user.email).trim();
  const byEmail = await fetchPatientByEmail(email);

  if (byEmail.data) {
    if (!byEmail.data.auth_user_id || byEmail.data.auth_user_id === user.id) {
      const { data, error } = await supabase
        .from('patients')
        .update({
          auth_user_id: user.id,
          full_name: input?.full_name ?? byEmail.data.full_name ?? defaultPatientNameFromUser(user),
          phone: input?.phone ?? byEmail.data.phone,
          country: input?.country ?? byEmail.data.country,
          preferred_language: input?.preferred_language ?? byEmail.data.preferred_language
        })
        .eq('id', byEmail.data.id)
        .select(patientColumnsWithElix)
        .single<Patient>();

      if (error) return { data: null, error, created: false };
      return { data: withFallbackElixId(data), error: null, created: false };
    }
  }

  const row = {
    auth_user_id: user.id,
    full_name: input?.full_name ?? defaultPatientNameFromUser(user),
    email,
    phone: input?.phone ?? null,
    country: input?.country ?? null,
    preferred_language: input?.preferred_language ?? 'en'
  };

  let result = await supabase.from('patients').insert(row).select(patientColumnsWithElix).single<Patient>();

  if (result.error?.message.includes('elix_id')) {
    result = await supabase.from('patients').insert(row).select(patientColumnsLegacy).single<Patient>();
  }

  if (result.error) return { data: null, error: result.error, created: false };
  return { data: withFallbackElixId(result.data), error: null, created: true };
}
