import type { ConsultationCurrency, ConsultationTier, Doctor } from '../types/doctor';
import { formatConsultationFee } from './consultationCurrency';
import { normalizeConsultationTiersInput } from './consultationTiers';
import { DOCTOR_PROFILE_COLUMNS, normalizeDoctorProfile } from './doctorProfile';
import { supabase } from './supabase';

const doctorColumns = DOCTOR_PROFILE_COLUMNS;

/** Display consultation fee in the doctor's currency (defaults to USD). */
export function formatConsultationFeeUsd(
  feeUsd: number,
  currency: ConsultationCurrency = 'USD'
): string {
  return formatConsultationFee(feeUsd, currency);
}

/** Supabase may return numeric columns as strings; normalize for UI. */
export function normalizeDoctor(row: Doctor): Doctor {
  return normalizeDoctorProfile(row);
}

/** Doctors visible in patient browse (is_visible true or unset). */
function applyPatientBrowseVisibilityFilter<T extends { or: (filters: string) => T }>(query: T): T {
  return query.or('is_visible.is.null,is_visible.eq.true');
}

function isMissingBrowseDoctorsRpc(error: { message?: string; code?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  const code = error?.code ?? '';
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('list_doctors_for_patient_browse') ||
    msg.includes('could not find the function')
  );
}

export async function fetchDoctors(limit = 50, options?: { patientClinicId?: string | null }) {
  const rpcResult = await supabase.rpc('list_doctors_for_patient_browse', { p_limit: limit });

  if (!rpcResult.error && rpcResult.data) {
    return {
      data: (rpcResult.data as Doctor[]).map((row) => normalizeDoctor(row)),
      error: null
    };
  }

  if (!isMissingBrowseDoctorsRpc(rpcResult.error)) {
    return { data: null, error: rpcResult.error };
  }

  const isClinicPatient = Boolean(options?.patientClinicId?.trim());

  let query = supabase
    .from('doctors')
    .select(doctorColumns)
    .is('deleted_at', null)
    .order('rating', { ascending: false })
    .limit(limit);

  if (!isClinicPatient) {
    query = applyPatientBrowseVisibilityFilter(query);
  }

  const result = await query;

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: (result.data ?? []).map((row) => normalizeDoctor(row as Doctor)),
    error: null
  };
}

export async function fetchDoctorById(id: string) {
  const result = await supabase.from('doctors').select(doctorColumns).eq('id', id).maybeSingle();

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: result.data ? normalizeDoctor(result.data as Doctor) : null,
    error: null
  };
}

export async function fetchPatientBrowseDoctorById(
  id: string,
  options?: { patientClinicId?: string | null }
) {
  const direct = await fetchDoctorById(id);
  if (direct.data) return direct;

  const browse = await fetchDoctors(200, options);
  if (browse.error) {
    return direct.error ? { data: null, error: direct.error } : { data: null, error: browse.error };
  }

  const fromBrowse = (browse.data ?? []).find((doctor) => doctor.id === id) ?? null;
  if (fromBrowse) {
    return { data: fromBrowse, error: null };
  }

  return { data: null, error: direct.error };
}

export async function fetchDoctorByEmail(email: string) {
  const result = await supabase
    .from('doctors')
    .select(doctorColumns)
    .ilike('email', email.trim())
    .maybeSingle();

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: result.data ? normalizeDoctor(result.data as Doctor) : null,
    error: null
  };
}

export async function fetchDoctorByAuthUserId(authUserId: string) {
  const result = await supabase
    .from('doctors')
    .select(doctorColumns)
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: result.data ? normalizeDoctor(result.data as Doctor) : null,
    error: null
  };
}

/** Distinct specialties from doctors the patient can request (platform or clinic workspace). */
export async function fetchDoctorSpecialties(options?: { patientClinicId?: string | null }) {
  const doctorsRes = await fetchDoctors(200, options);
  if (doctorsRes.error) {
    return { data: null, error: doctorsRes.error };
  }

  const specialties = [
    ...new Set(
      (doctorsRes.data ?? [])
        .map((doctor) => doctor.specialty?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ].sort((a, b) => a.localeCompare(b));

  return { data: specialties, error: null };
}

export async function updateDoctorConsultationPricing(
  tiers: ConsultationTier[],
  currency: ConsultationCurrency
) {
  const normalized = normalizeConsultationTiersInput(tiers);
  const { error } = await supabase.rpc('update_own_doctor_consultation_pricing', {
    p_tiers: normalized,
    p_currency: currency
  });

  if (error) {
    return { data: null, error };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: { message: 'Not signed in.' } };
  }

  return fetchDoctorByAuthUserId(user.id);
}
