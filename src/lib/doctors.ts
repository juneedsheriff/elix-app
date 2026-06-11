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

export async function fetchDoctors(limit = 50) {
  const result = await supabase
    .from('doctors')
    .select(doctorColumns)
    .eq('is_visible', true)
    .is('deleted_at', null)
    .order('rating', { ascending: false })
    .limit(limit);

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

/** Distinct specialties from visible doctors (for patient recommendation requests). */
export async function fetchDoctorSpecialties() {
  const result = await supabase
    .from('doctors')
    .select('specialty')
    .eq('is_visible', true)
    .is('deleted_at', null);

  if (result.error) {
    return { data: null, error: result.error };
  }

  const specialties = [
    ...new Set(
      (result.data ?? [])
        .map((row) => row.specialty?.trim())
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
