import type { User } from '@supabase/supabase-js';
import type { Patient, PatientOnboardingInput, PatientProfileUpdateInput } from '../types/patient';
import { isPatientProfileComplete } from './patientProfileCompleteness';
import { supabase } from './supabase';

const patientColumnsExtended =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, address, height_cm, weight_kg, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, profile_completed_at, created_at, updated_at';

const patientColumnsWithElix =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, created_at, updated_at';

const patientColumnsLegacy =
  'id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, created_at, updated_at';

function withFallbackElixId(patient: Patient | null): Patient | null {
  if (!patient || patient.elix_id) return patient;
  const suffix = patient.id.replace(/-/g, '').slice(0, 6).toLowerCase();
  return { ...patient, elix_id: `elix-${suffix.padEnd(6, '0').slice(0, 6)}` };
}

function normalizePatientRow(patient: Patient | null): Patient | null {
  if (!patient) return null;
  return {
    ...patient,
    address: patient.address ?? null,
    height_cm: patient.height_cm ?? null,
    weight_kg: patient.weight_kg ?? null,
    profile_completed_at: patient.profile_completed_at ?? null
  };
}

async function selectPatient(
  build: (columns: string) => ReturnType<typeof supabase.from<'patients'>>
) {
  const extended = await build(patientColumnsExtended).maybeSingle();
  if (!extended.error) {
    return { data: withFallbackElixId(normalizePatientRow(extended.data as Patient | null)), error: null };
  }

  const missingColumn = /address|profile_completed_at|height_cm|weight_kg|elix_id|column/.test(
    extended.error.message
  );
  if (!missingColumn) {
    return { data: null, error: extended.error };
  }

  const withElix = await build(patientColumnsWithElix).maybeSingle();
  if (!withElix.error) {
    return { data: withFallbackElixId(normalizePatientRow(withElix.data as Patient | null)), error: null };
  }
  if (!withElix.error.message.includes('elix_id')) {
    return { data: null, error: withElix.error };
  }

  const legacy = await build(patientColumnsLegacy).maybeSingle();
  if (legacy.error) return { data: null, error: legacy.error };
  return { data: withFallbackElixId(normalizePatientRow(legacy.data as Patient | null)), error: null };
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

/** Split stored full_name for profile edit forms. */
export function splitPatientFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() };
}

export function joinPatientFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
}

/** Patient updates their own profile (RLS: patients_update_own). */
export async function updatePatientProfileForUser(
  authUserId: string,
  input: PatientProfileUpdateInput
) {
  const full_name = input.full_name.trim();
  if (!full_name) {
    return { data: null, error: { message: 'Enter your first name.' } };
  }

  let { data, error } = await supabase
    .from('patients')
    .update({
      full_name,
      phone: input.phone?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('auth_user_id', authUserId)
    .select(patientColumnsWithElix)
    .single<Patient>();

  if (error?.message.includes('elix_id')) {
    const legacy = await supabase
      .from('patients')
      .update({
        full_name,
        phone: input.phone?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId)
      .select(patientColumnsLegacy)
      .single<Patient>();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return { data: null, error };
  return { data: withFallbackElixId(data), error: null };
}

/** Save post-verification onboarding answers from the chat wizard. */
export async function completePatientOnboarding(authUserId: string, input: PatientOnboardingInput) {
  const phone = input.phone.trim();
  const gender = input.gender.trim();
  const date_of_birth = input.date_of_birth.trim();
  const address = input.address.trim();
  const blood_group = input.blood_group.trim();

  if (!phone) return { data: null, error: { message: 'Enter your mobile number.' } };
  if (!gender) return { data: null, error: { message: 'Select your gender.' } };
  if (!date_of_birth) return { data: null, error: { message: 'Enter your date of birth.' } };
  if (!address) return { data: null, error: { message: 'Enter your address.' } };
  if (!blood_group) return { data: null, error: { message: 'Select your blood group.' } };

  const payload = {
    phone,
    gender,
    date_of_birth,
    address,
    city: address,
    blood_group,
    height_cm: input.height_cm ?? null,
    weight_kg: input.weight_kg ?? null,
    profile_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let { data, error } = await supabase
    .from('patients')
    .update(payload)
    .eq('auth_user_id', authUserId)
    .select(patientColumnsExtended)
    .single<Patient>();

  if (error?.message.includes('address') || error?.message.includes('profile_completed_at')) {
    const fallback = await supabase
      .from('patients')
      .update({
        phone,
        gender,
        date_of_birth,
        city: address,
        blood_group,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId)
      .select(patientColumnsWithElix)
      .single<Patient>();
    data = fallback.data;
    error = fallback.error;
  }

  if (error?.message.includes('elix_id')) {
    const legacy = await supabase
      .from('patients')
      .update({
        phone,
        gender,
        date_of_birth,
        city: address,
        blood_group,
        updated_at: new Date().toISOString()
      })
      .eq('auth_user_id', authUserId)
      .select(patientColumnsLegacy)
      .single<Patient>();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) return { data: null, error };
  const patient = withFallbackElixId(normalizePatientRow(data));
  if (patient && !isPatientProfileComplete(patient)) {
    return {
      data: patient,
      error: { message: 'Profile saved but some required fields are still missing.' }
    };
  }
  return { data: patient, error: null };
}
