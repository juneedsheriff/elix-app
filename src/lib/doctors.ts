import type { Doctor } from '../types/doctor';
import { supabase } from './supabase';

const doctorColumns =
  'id, full_name, specialty, years_experience, hospital, rating, languages, fee_usd, image_url, country, bio, email, phone';

/** Supabase may return numeric columns as strings; normalize for UI. */
export function normalizeDoctor(row: Doctor): Doctor {
  return {
    ...row,
    years_experience: Number(row.years_experience),
    rating: Number(row.rating),
    fee_usd: Number(row.fee_usd)
  };
}

export async function fetchDoctors(limit = 50) {
  const result = await supabase
    .from('doctors')
    .select(doctorColumns)
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
