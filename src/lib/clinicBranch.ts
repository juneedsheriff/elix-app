import type { ConsultationCurrency } from '../types/doctor';
import {
  consultationCurrencyForPseCountry,
  DEFAULT_PSE_COUNTRY,
  normalizePseCountry,
  type PseCountry
} from './pseCountry';
import { supabase } from './supabase';

export const CLINIC_BRANCH_SERVICES = [
  'Home Nursing Services',
  'Doctor Consultation',
  'Second Opinion',
  'Physiotherapy Services',
  'Medical Records Online',
  'Sample Collection at Home',
  'Parent Care Services',
  'Post-Surgery Care',
  'Surgery Referral & Coordination',
  'Lab & Diagnostics',
  'Digital X-Ray',
  'Other Healthcare Support Services'
] as const;

export const DEFAULT_CLINIC_INCHARGE_PHONE = '990-117-8340';
export const HEAD_OFFICE_PHONE = '9449811444';
export const HEAD_OFFICE_EMAIL = 'support@elixclinix.com';

export type PseClinicBranch = {
  id: string;
  name: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  country: PseCountry;
};

function mapBranchRow(row: {
  id: string;
  name?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
}): PseClinicBranch {
  return {
    id: row.id,
    name: row.name?.trim() || 'ElixClinix branch',
    location: row.location?.trim() || null,
    email: row.email?.trim() || null,
    phone: row.phone?.trim() || null,
    country: normalizePseCountry(row.country ?? DEFAULT_PSE_COUNTRY)
  };
}

export function clinicBranchContactPhone(branch: Pick<PseClinicBranch, 'phone'> | null | undefined): string {
  return branch?.phone?.trim() || DEFAULT_CLINIC_INCHARGE_PHONE;
}

export function clinicBranchEmail(branch: Pick<PseClinicBranch, 'email'> | null | undefined): string {
  return branch?.email?.trim() || HEAD_OFFICE_EMAIL;
}

/**
 * Patient-facing consultation currency from clinic assignment.
 * - No clinic (global patient) → USD
 * - India PSE → INR
 * - Other PSE countries → USD
 */
export async function consultationCurrencyForClinicId(
  clinicId: string | null | undefined
): Promise<ConsultationCurrency> {
  const id = clinicId?.trim();
  if (!id) return 'USD';
  const { data } = await fetchAssignedClinicBranch(id);
  return consultationCurrencyForPseCountry(data?.country ?? DEFAULT_PSE_COUNTRY);
}

export async function fetchAssignedClinicBranch(clinicId: string | null | undefined) {
  const id = clinicId?.trim();
  if (!id) return { data: null, error: null };

  const withDetails = await supabase
    .from('pse_clinics')
    .select('id, name, location, email, phone, country')
    .eq('id', id)
    .maybeSingle();

  if (!withDetails.error) {
    return {
      data: withDetails.data ? mapBranchRow(withDetails.data) : null,
      error: null
    };
  }

  if (!/location|email|phone|country|column/i.test(withDetails.error.message ?? '')) {
    return { data: null, error: { message: withDetails.error.message } };
  }

  const legacy = await supabase.from('pse_clinics').select('id, name').eq('id', id).maybeSingle();
  if (legacy.error) {
    return { data: null, error: { message: legacy.error.message } };
  }
  if (!legacy.data) return { data: null, error: null };

  return {
    data: mapBranchRow(legacy.data as { id: string; name?: string | null }),
    error: null
  };
}

export async function updatePseClinicBranchDetails(
  clinicId: string,
  input: {
    location?: string | null;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
  }
) {
  const id = clinicId.trim();
  if (!id) return { data: null, error: { message: 'Clinic id is required.' } };

  const payload: Record<string, unknown> = {
    location: input.location?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    updated_at: new Date().toISOString()
  };
  if (input.country !== undefined) {
    payload.country = normalizePseCountry(input.country);
  }

  const { data, error } = await supabase
    .from('pse_clinics')
    .update(payload)
    .eq('id', id)
    .select('id, name, location, email, phone, country')
    .maybeSingle();

  if (error) {
    const hint = /location|email|phone|country|column/i.test(error.message)
      ? ' Run npm run db:apply-clinic-branch-details and npm run db:apply-pse-clinic-country (migrations 085/089).'
      : '';
    return { data: null, error: { message: `${error.message}${hint}` } };
  }
  if (!data) return { data: null, error: { message: 'Clinic workspace not found.' } };

  return { data: mapBranchRow(data), error: null };
}
