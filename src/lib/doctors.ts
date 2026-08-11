import type { ConsultationCurrency, ConsultationTier, Doctor } from '../types/doctor';
import { isDoctorAvailableToClinic } from './clinicDoctorRequests';
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

/** Greeting label for dashboards, e.g. "Dr. Subhash". */
export function formatDoctorWelcomeName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return 'Doctor';

  const withoutTitle = trimmed.replace(/^dr\.?\s*/i, '').trim();
  const firstName = (withoutTitle || trimmed).split(/\s+/)[0] ?? trimmed;
  return `Dr. ${firstName}`;
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

/** Doctors linked to a clinic workspace (owned + granted). */
export async function fetchClinicLinkedDoctors(clinicId: string) {
  const normalizedClinicId = clinicId.trim();
  if (!normalizedClinicId) {
    return { data: [] as Doctor[], error: null };
  }

  const [ownedDoctorsRes, grantedIdsRes] = await Promise.all([
    supabase
      .from('doctors')
      .select(doctorColumns)
      .is('deleted_at', null)
      .eq('clinic_id', normalizedClinicId)
      .order('full_name', { ascending: true }),
    supabase.from('clinic_doctor_grants').select('doctor_id').eq('clinic_id', normalizedClinicId)
  ]);

  if (ownedDoctorsRes.error || grantedIdsRes.error) {
    const browseDoctorsRes = await fetchDoctors(250, { patientClinicId: normalizedClinicId });
    if (browseDoctorsRes.error) {
      return { data: null, error: ownedDoctorsRes.error ?? grantedIdsRes.error ?? browseDoctorsRes.error };
    }

    const candidateDoctors = browseDoctorsRes.data ?? [];
    const availabilityChecks = await Promise.all(
      candidateDoctors.map(async (doctor) => {
        const availableRes = await isDoctorAvailableToClinic(doctor.id, normalizedClinicId);
        return {
          doctor,
          available: availableRes.available && !availableRes.error
        };
      })
    );

    const linkedDoctors = availabilityChecks
      .filter((entry) => entry.available)
      .map((entry) => entry.doctor)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    return { data: linkedDoctors, error: null };
  }

  const ownedDoctors = (ownedDoctorsRes.data ?? []).map((row) => normalizeDoctor(row as Doctor));
  const ownedDoctorIds = new Set(ownedDoctors.map((doctor) => doctor.id));
  const grantedDoctorIds = [...new Set((grantedIdsRes.data ?? []).map((row) => row.doctor_id as string))]
    .filter((doctorId) => doctorId && !ownedDoctorIds.has(doctorId));

  let grantedDoctors: Doctor[] = [];
  if (grantedDoctorIds.length) {
    const grantedDoctorsRes = await supabase
      .from('doctors')
      .select(doctorColumns)
      .is('deleted_at', null)
      .in('id', grantedDoctorIds)
      .order('full_name', { ascending: true });

    if (grantedDoctorsRes.error) {
      return { data: null, error: grantedDoctorsRes.error };
    }

    grantedDoctors = (grantedDoctorsRes.data ?? []).map((row) => normalizeDoctor(row as Doctor));
  }

  const deduped = new Map<string, Doctor>();
  for (const doctor of [...ownedDoctors, ...grantedDoctors]) {
    deduped.set(doctor.id, doctor);
  }

  return {
    data: [...deduped.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    error: null
  };
}

/** Doctors that belong to the same clinic roster (not grants-based). */
export async function fetchDoctorsInClinicRoster(options: {
  clinicId?: string | null;
  clinicName?: string | null;
  pseClinicName?: string | null;
}) {
  const clinicId = options.clinicId?.trim() || '';
  const clinicName = options.clinicName?.trim() || '';
  const pseClinicName = options.pseClinicName?.trim() || '';

  const byIdQuery = clinicId
    ? supabase
        .from('doctors')
        .select(doctorColumns)
        .is('deleted_at', null)
        .eq('clinic_id', clinicId)
        .order('full_name', { ascending: true })
    : null;

  const byClinicNameQuery = clinicName
    ? supabase
        .from('doctors')
        .select(doctorColumns)
        .is('deleted_at', null)
        .ilike('clinic_name', `%${clinicName}%`)
        .order('full_name', { ascending: true })
    : null;

  const byPseClinicNameQuery = pseClinicName
    ? supabase
        .from('doctors')
        .select(doctorColumns)
        .is('deleted_at', null)
        .ilike('pse_clinic_name', `%${pseClinicName}%`)
        .order('full_name', { ascending: true })
    : null;

  const [byIdRes, byClinicNameRes, byPseClinicNameRes] = await Promise.all([
    byIdQuery ?? Promise.resolve({ data: [], error: null }),
    byClinicNameQuery ?? Promise.resolve({ data: [], error: null }),
    byPseClinicNameQuery ?? Promise.resolve({ data: [], error: null })
  ]);

  const rows = [
    ...(byIdRes.data ?? []),
    ...(byClinicNameRes.data ?? []),
    ...(byPseClinicNameRes.data ?? [])
  ] as Doctor[];

  if (!rows.length && (byIdRes.error || byClinicNameRes.error || byPseClinicNameRes.error)) {
    return { data: null, error: byIdRes.error ?? byClinicNameRes.error ?? byPseClinicNameRes.error };
  }

  const deduped = new Map<string, Doctor>();
  for (const row of rows) {
    const normalized = normalizeDoctor(row);
    deduped.set(normalized.id, normalized);
  }

  return {
    data: [...deduped.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
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

export type OwnDoctorProfileUpdateInput = {
  full_name: string;
  gender: string | null;
  mobile_no: string;
  qualification: string | null;
  specialization: string | null;
  about_doctor: string | null;
  work_experience: string | null;
  awards_recognitions: string | null;
  membership: string | null;
  languages: string;
  image_url: string;
};

export async function updateOwnDoctorProfile(input: OwnDoctorProfileUpdateInput) {
  const fullName = input.full_name.trim();
  if (!fullName) {
    return { data: null, error: { message: 'Full name is required.' } };
  }

  const { error } = await supabase.rpc('update_own_doctor_profile', {
    p_full_name: fullName,
    p_gender: input.gender?.trim() || null,
    p_mobile_no: input.mobile_no.trim() || null,
    p_qualification: input.qualification?.trim() || null,
    p_specialization: input.specialization?.trim() || null,
    p_about_doctor: input.about_doctor?.trim() || null,
    p_work_experience: input.work_experience?.trim() || null,
    p_awards_recognitions: input.awards_recognitions?.trim() || null,
    p_membership: input.membership?.trim() || null,
    p_languages: input.languages.trim() || null,
    p_image_url: input.image_url.trim() || null
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
