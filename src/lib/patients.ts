import type { User } from '@supabase/supabase-js';
import type { Patient, PatientOnboardingInput, PatientProfileUpdateInput } from '../types/patient';
import { isPatientProfileComplete } from './patientProfileCompleteness';
import { supabase } from './supabase';

const patientColumnsExtended =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, address, height_cm, weight_kg, allergies, family_history, social_history, surgical_history, medical_history, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, profile_completed_at, clinic_id, login_disabled, deleted_at, created_at, updated_at';

const patientColumnsWithElix =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, login_disabled, deleted_at, created_at, updated_at';

/** Pre–soft-delete schema (no deleted_at). */
const patientColumnsWithoutDeletedAt =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, login_disabled, created_at, updated_at';

const patientColumnsLegacy =
  'id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, login_disabled, created_at, updated_at';

function withFallbackElixId(patient: Patient | null): Patient | null {
  if (!patient || patient.elix_id) return patient;
  const id = patient.id;
  if (typeof id !== 'string' || !id.trim()) return patient;
  const suffix = id.replace(/-/g, '').slice(0, 6).toLowerCase();
  return { ...patient, elix_id: `elix-${suffix.padEnd(6, '0').slice(0, 6)}` };
}

function normalizePatientRow(patient: Patient | null): Patient | null {
  if (!patient) return null;
  return {
    ...patient,
    address: patient.address ?? null,
    height_cm: patient.height_cm ?? null,
    weight_kg: patient.weight_kg ?? null,
    family_history: patient.family_history ?? null,
    social_history: patient.social_history ?? null,
    surgical_history: patient.surgical_history ?? null,
    medical_history: patient.medical_history ?? null,
    profile_completed_at: patient.profile_completed_at ?? null,
    login_disabled: Boolean(patient.login_disabled),
    deleted_at: patient.deleted_at ?? null
  };
}

/** Soft-deleted or login-disabled patients must not use the patient app. */
export function isPatientLoginBlocked(patient: Patient | null | undefined): boolean {
  if (!patient) return false;
  return Boolean(patient.login_disabled) || Boolean(patient.deleted_at?.trim());
}

export const PATIENT_LOGIN_BLOCKED_MESSAGE =
  'This patient account has been disabled. Contact your clinic or administrator if you need access.';

export function patientLoginBlockedMessage(patient: Patient): string {
  if (patient.deleted_at?.trim()) return PATIENT_LOGIN_BLOCKED_MESSAGE;
  if (patient.login_disabled) {
    return 'Your patient login is not enabled yet. Ask your clinic to enable login for your account.';
  }
  return PATIENT_LOGIN_BLOCKED_MESSAGE;
}

async function selectPatient(
  build: (columns: string) => ReturnType<typeof supabase.from<'patients'>>
) {
  const extended = await build(patientColumnsExtended).maybeSingle();
  if (!extended.error) {
    return { data: withFallbackElixId(normalizePatientRow(extended.data as Patient | null)), error: null };
  }

  const missingColumn =
    /address|profile_completed_at|height_cm|weight_kg|family_history|social_history|surgical_history|medical_history|elix_id|clinic_id|login_disabled|deleted_at|column/.test(
      extended.error.message
    );
  if (!missingColumn) {
    return { data: null, error: extended.error };
  }

  const withElix = await build(patientColumnsWithElix).maybeSingle();
  if (!withElix.error) {
    return { data: withFallbackElixId(normalizePatientRow(withElix.data as Patient | null)), error: null };
  }

  if (/deleted_at/.test(withElix.error.message)) {
    const withoutDeleted = await build(patientColumnsWithoutDeletedAt).maybeSingle();
    if (!withoutDeleted.error) {
      return {
        data: withFallbackElixId(normalizePatientRow(withoutDeleted.data as Patient | null)),
        error: null
      };
    }
    if (!withoutDeleted.error.message.includes('elix_id')) {
      return { data: null, error: withoutDeleted.error };
    }
  } else if (!withElix.error.message.includes('elix_id')) {
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

/** Link a clinic/staff-created patient row to the current auth session (RLS-safe). */
export async function claimPatientProfileForLogin() {
  const { data, error } = await supabase.rpc('claim_patient_profile_for_login').maybeSingle<Patient>();
  if (error) {
    const missingRpc =
      error.message.includes('claim_patient_profile_for_login') || error.code === '42883';
    if (missingRpc) {
      return {
        data: null,
        error: {
          message:
            'Patient login linking is not configured. Run supabase/migrations/065_claim_clinic_patient_login.sql.'
        }
      };
    }
    return { data: null, error };
  }
  if (!data?.id) {
    return { data: null, error: null };
  }
  return { data: withFallbackElixId(normalizePatientRow(data)), error: null };
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
  if (byAuth.data) {
    if (isPatientLoginBlocked(byAuth.data)) {
      return {
        data: null,
        error: { message: PATIENT_LOGIN_BLOCKED_MESSAGE },
        created: false
      };
    }
    return { data: byAuth.data, error: null, created: false };
  }
  if (byAuth.error) return { data: null, error: byAuth.error, created: false };

  const email = (input?.email ?? user.email ?? '').trim();
  if (!email) {
    return { data: null, error: { message: 'User email is required for patient profile.' }, created: false };
  }

  const claimed = await claimPatientProfileForLogin();
  if (claimed.data) {
    if (isPatientLoginBlocked(claimed.data)) {
      return {
        data: null,
        error: { message: PATIENT_LOGIN_BLOCKED_MESSAGE },
        created: false
      };
    }
    return { data: claimed.data, error: null, created: false };
  }
  if (claimed.error) return { data: null, error: claimed.error, created: false };
  const byEmail = await fetchPatientByEmail(email);

  if (byEmail.data) {
    if (isPatientLoginBlocked(byEmail.data)) {
      return {
        data: null,
        error: { message: PATIENT_LOGIN_BLOCKED_MESSAGE },
        created: false
      };
    }
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

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

const OPTIONAL_PATIENT_PAYLOAD_KEYS = [
  'address',
  'height_cm',
  'weight_kg',
  'profile_completed_at',
  'family_history',
  'social_history',
  'surgical_history',
  'medical_history'
] as const;

function isMissingPatientColumnError(message: string): boolean {
  return /address|profile_completed_at|height_cm|weight_kg|family_history|social_history|surgical_history|medical_history|elix_id|column/.test(
    message
  );
}

function stripOptionalPatientPayload<T extends Record<string, unknown>>(payload: T): T {
  const next = { ...payload };
  for (const key of OPTIONAL_PATIENT_PAYLOAD_KEYS) {
    delete next[key];
  }
  return next;
}

function hasOptionalPatientPayloadValues(payload: Record<string, unknown>): boolean {
  return OPTIONAL_PATIENT_PAYLOAD_KEYS.some((key) => {
    const value = payload[key];
    return value !== undefined && value !== null && value !== '';
  });
}

async function patchPatientByAuthUserId(
  authUserId: string,
  payload: Record<string, unknown>,
  selectColumns: string
) {
  return supabase
    .from('patients')
    .update(payload)
    .eq('auth_user_id', authUserId)
    .select(selectColumns)
    .single<Patient>();
}

async function updatePatientByAuthUserId(
  authUserId: string,
  payload: Record<string, unknown>
): Promise<{ data: Patient | null; error: { message: string } | null }> {
  const finalize = (patient: Patient | null) => ({
    data: withFallbackElixId(normalizePatientRow(patient)),
    error: null as { message: string } | null
  });

  let { data, error } = await patchPatientByAuthUserId(authUserId, payload, patientColumnsExtended);

  if (!error) return finalize(data);
  if (!isMissingPatientColumnError(error.message)) return { data: null, error };

  const optionalMissing =
    /address|height_cm|weight_kg|profile_completed_at|family_history|social_history|surgical_history|medical_history/.test(
      error.message
    );
  const optionalInPayload = OPTIONAL_PATIENT_PAYLOAD_KEYS.some((key) => key in payload);

  if (optionalMissing && optionalInPayload) {
    const stripped = stripOptionalPatientPayload(payload);
    const droppedOptionalValues = hasOptionalPatientPayloadValues(payload);
    const fallback = await patchPatientByAuthUserId(authUserId, stripped, patientColumnsWithElix);

    if (!fallback.error) {
      if (droppedOptionalValues) {
        return {
          data: withFallbackElixId(normalizePatientRow(fallback.data)),
          error: {
            message:
              'Some profile fields could not be saved. Ask your administrator to run: npm run db:apply-patient-extended-profile and npm run db:apply-patient-medical-history'
          }
        };
      }
      return finalize(fallback.data);
    }
    error = fallback.error;
  }

  if (error && isMissingPatientColumnError(error.message)) {
    const retry = await patchPatientByAuthUserId(authUserId, stripOptionalPatientPayload(payload), patientColumnsWithElix);
    if (!retry.error) return finalize(retry.data);
    error = retry.error;
  }

  if (error?.message.includes('elix_id')) {
    const legacy = await patchPatientByAuthUserId(authUserId, stripOptionalPatientPayload(payload), patientColumnsLegacy);
    if (legacy.error) return { data: null, error: legacy.error };
    return finalize(legacy.data);
  }

  return { data: null, error };
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

  const payload = {
    full_name,
    phone: trimOrNull(input.phone),
    date_of_birth: trimOrNull(input.date_of_birth),
    gender: trimOrNull(input.gender),
    blood_group: trimOrNull(input.blood_group),
    country: trimOrNull(input.country),
    city: trimOrNull(input.city),
    address: trimOrNull(input.address),
    height_cm: input.height_cm ?? null,
    weight_kg: input.weight_kg ?? null,
    allergies: trimOrNull(input.allergies),
    family_history: trimOrNull(input.family_history),
    social_history: trimOrNull(input.social_history),
    surgical_history: trimOrNull(input.surgical_history),
    medical_history: trimOrNull(input.medical_history),
    current_medications: trimOrNull(input.current_medications),
    insurance_provider: trimOrNull(input.insurance_provider),
    emergency_contact_name: trimOrNull(input.emergency_contact_name),
    emergency_contact_phone: trimOrNull(input.emergency_contact_phone),
    preferred_language: trimOrNull(input.preferred_language) ?? 'en',
    ...(input.avatar_url !== undefined ? { avatar_url: input.avatar_url } : {}),
    updated_at: new Date().toISOString()
  };

  return updatePatientByAuthUserId(authUserId, payload);
}

/** Patient updates their profile photo (optional; RLS: patients_update_own). */
export async function updatePatientAvatarForUser(authUserId: string, avatar_url: string | null) {
  const { error: updateError } = await supabase
    .from('patients')
    .update({
      avatar_url,
      updated_at: new Date().toISOString()
    })
    .eq('auth_user_id', authUserId);

  if (updateError) return { data: null, error: updateError };
  return fetchPatientByAuthUserId(authUserId);
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

  const result = await updatePatientByAuthUserId(authUserId, payload);
  if (result.error) return result;

  const patient = result.data;
  if (patient && !isPatientProfileComplete(patient)) {
    return {
      data: patient,
      error: { message: 'Profile saved but some required fields are still missing.' }
    };
  }
  return { data: patient, error: null };
}
