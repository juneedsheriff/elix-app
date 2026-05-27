import type { AuthError } from '@supabase/supabase-js';
import type { Admin } from '../types/admin';
import type { AdminDoctorUpdateInput, Doctor } from '../types/doctor';
import type { Patient } from '../types/patient';
import { adminInputToDbRow, DOCTOR_PROFILE_COLUMNS } from './doctorProfile';
import { normalizeDoctor } from './doctors';
import { supabase } from './supabase';

const adminColumns = 'id, auth_user_id, email, full_name, role, is_active, created_at, updated_at';

const patientAdminColumns =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, login_disabled, created_at, updated_at';

const doctorAdminColumns = DOCTOR_PROFILE_COLUMNS;

export type { AdminDoctorUpdateInput };

export type AdminPatientUpdateInput = {
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  country: string | null;
  city: string | null;
  allergies: string | null;
  current_medications: string | null;
  insurance_provider: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_language: string;
};

export async function fetchAdminByAuthUserId(authUserId: string) {
  const result = await supabase
    .from('admins')
    .select(adminColumns)
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .maybeSingle();

  if (result.error) return { data: null, error: result.error };
  return { data: result.data ? normalizeAdmin(result.data as Admin) : null, error: null };
}

export async function fetchAdminByEmail(email: string) {
  const result = await supabase
    .from('admins')
    .select(adminColumns)
    .ilike('email', email.trim())
    .eq('is_active', true)
    .maybeSingle();

  if (result.error) return { data: null, error: result.error };
  return { data: result.data ? normalizeAdmin(result.data as Admin) : null, error: null };
}

export async function fetchAllAdmins() {
  const result = await supabase
    .from('admins')
    .select(adminColumns)
    .order('created_at', { ascending: true });

  if (result.error) return { data: null, error: result.error };
  return { data: (result.data ?? []).map(normalizeAdmin), error: null };
}

export async function fetchPatientServiceExecutives() {
  const result = await supabase
    .from('admins')
    .select(adminColumns)
    .eq('role', 'patient_service_executive')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (result.error) return { data: null, error: result.error };
  return { data: (result.data ?? []).map(normalizeAdmin), error: null };
}

function normalizeAdmin(row: Admin): Admin {
  return {
    ...row,
    role: row.role === 'patient_service_executive' ? 'patient_service_executive' : 'administrator'
  };
}

export async function fetchAllPatientsForAdmin() {
  const result = await supabase
    .from('patients')
    .select(patientAdminColumns)
    .order('created_at', { ascending: false });

  if (result.error) return { data: null, error: result.error };
  return { data: (result.data ?? []) as Patient[], error: null };
}

export async function fetchAllDoctorsForAdmin() {
  const result = await supabase
    .from('doctors')
    .select(doctorAdminColumns)
    .is('deleted_at', null)
    .order('full_name', { ascending: true });

  if (result.error) return { data: null, error: result.error };
  return {
    data: (result.data ?? []).map((row) => normalizeDoctor(row as Doctor)),
    error: null
  };
}

export async function updateDoctorForAdmin(id: string, input: AdminDoctorUpdateInput) {
  const { error: updateError, count } = await supabase
    .from('doctors')
    .update(adminInputToDbRow(input), { count: 'exact' })
    .eq('id', id);

  if (updateError) return { data: null, error: updateError };
  if (count === 0) {
    return {
      data: null,
      error: {
        message:
          'No doctor row was updated. Ensure you are signed in as admin and run migration 013_admin_profile_updates.sql (npm run db:apply-admin-update-policies).'
      }
    };
  }

  const { data, error: fetchError } = await supabase
    .from('doctors')
    .select(doctorAdminColumns)
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return { data: null, error: fetchError };
  if (!data) {
    return { data: null, error: { message: 'Doctor was updated but could not be reloaded.' } };
  }
  return { data: normalizeDoctor(data as Doctor), error: null };
}

export async function setDoctorVisibilityForAdmin(id: string, isVisible: boolean) {
  const { error: updateError } = await supabase
    .from('doctors')
    .update({
      is_visible: isVisible
    })
    .eq('id', id)
    .is('deleted_at', null);

  if (updateError) return { error: updateError };
  return { error: null };
}

export async function deleteDoctorForAdmin(id: string) {
  const { error: updateError } = await supabase
    .from('doctors')
    .update({
      is_visible: false,
      deleted_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null);

  if (updateError) return { error: updateError };
  return { error: null };
}

export async function updatePatientForAdmin(id: string, input: AdminPatientUpdateInput) {
  const { error: updateError, count } = await supabase
    .from('patients')
    .update(
      {
        full_name: input.full_name.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || null,
        date_of_birth: input.date_of_birth || null,
        gender: input.gender?.trim() || null,
        blood_group: input.blood_group?.trim() || null,
        country: input.country?.trim() || null,
        city: input.city?.trim() || null,
        allergies: input.allergies?.trim() || null,
        current_medications: input.current_medications?.trim() || null,
        insurance_provider: input.insurance_provider?.trim() || null,
        emergency_contact_name: input.emergency_contact_name?.trim() || null,
        emergency_contact_phone: input.emergency_contact_phone?.trim() || null,
        preferred_language: input.preferred_language.trim() || 'en',
        updated_at: new Date().toISOString()
      },
      { count: 'exact' }
    )
    .eq('id', id);

  if (updateError) return { data: null, error: updateError };
  if (count === 0) {
    return {
      data: null,
      error: {
        message:
          'No patient row was updated. Ensure you are signed in as admin and run migration 013_admin_profile_updates.sql (npm run db:apply-admin-update-policies).'
      }
    };
  }

  const { data, error: fetchError } = await supabase
    .from('patients')
    .select(patientAdminColumns)
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return { data: null, error: fetchError };
  if (!data) {
    return { data: null, error: { message: 'Patient was updated but could not be reloaded.' } };
  }
  return { data: data as Patient, error: null };
}

export async function adminSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) {
    return { error, admin: null };
  }

  const user = data.user;
  if (!user) {
    return {
      error: { message: 'Sign in failed', name: 'AuthError', status: 500 } as AuthError,
      admin: null
    };
  }

  let admin: Admin | null = null;
  const byAuth = await fetchAdminByAuthUserId(user.id);
  admin = byAuth.data;

  if (!admin && user.email) {
    const byEmail = await fetchAdminByEmail(user.email);
    admin = byEmail.data;
  }

  if (!admin && user.user_metadata?.role === 'admin') {
    const byEmail = user.email ? await fetchAdminByEmail(user.email) : { data: null };
    admin = byEmail.data;
  }

  if (!admin) {
    await supabase.auth.signOut();
    return {
      error: {
        message: 'This account is not authorized for Elix Health staff.',
        name: 'AuthError',
        status: 403
      } as AuthError,
      admin: null
    };
  }

  return { error: null, admin };
}

export async function adminSignOut() {
  await supabase.auth.signOut();
}
