import type { AuthError } from '@supabase/supabase-js';
import type { Admin } from '../types/admin';
import type { AdminDoctorUpdateInput, Doctor } from '../types/doctor';
import type { Patient } from '../types/patient';
import { adminInputToDbRow, DOCTOR_PROFILE_COLUMNS } from './doctorProfile';
import { normalizeDoctor } from './doctors';
import { supabase } from './supabase';

const ADMIN_COLUMNS_BASE =
  'id, auth_user_id, email, full_name, role, is_active, created_at, updated_at';

const ADMIN_COLUMNS_WITH_CLINIC = `${ADMIN_COLUMNS_BASE}, clinic_id, pse_clinics(name)`;

function isMissingClinicSchemaError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('clinic_id') ||
    message.includes('pse_clinics') ||
    message.includes('patient_service_executive_clinic') ||
    error.code === '42703' ||
    error.code === 'PGRST200'
  );
}

type AdminRow = Admin & { pse_clinics?: { name: string } | { name: string }[] | null };

async function queryAdminSingle(
  applyFilters: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
) {
  const extended = await applyFilters(supabase.from('admins').select(ADMIN_COLUMNS_WITH_CLINIC)).maybeSingle();
  if (!extended.error) return extended;

  if (!isMissingClinicSchemaError(extended.error)) {
    return extended;
  }

  return applyFilters(supabase.from('admins').select(ADMIN_COLUMNS_BASE)).maybeSingle();
}

async function queryAdminList(
  applyFilters: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
) {
  const extended = await applyFilters(supabase.from('admins').select(ADMIN_COLUMNS_WITH_CLINIC));
  if (!extended.error) return extended;

  if (!isMissingClinicSchemaError(extended.error)) {
    return extended;
  }

  return applyFilters(supabase.from('admins').select(ADMIN_COLUMNS_BASE));
}

const patientAdminColumns =
  'id, elix_id, auth_user_id, full_name, email, phone, date_of_birth, gender, blood_group, country, city, allergies, current_medications, insurance_provider, emergency_contact_name, emergency_contact_phone, preferred_language, avatar_url, login_disabled, clinic_id, created_at, updated_at';

const patientAdminColumnsWithClinic = `${patientAdminColumns}, pse_clinics(name)`;

type PatientAdminRow = Patient & { pse_clinics?: { name: string } | { name: string }[] | null };

function mapPatientAdminRow(row: PatientAdminRow): Patient {
  const clinicRef = row.pse_clinics;
  const clinicName = Array.isArray(clinicRef) ? clinicRef[0]?.name : clinicRef?.name ?? null;
  const { pse_clinics: _clinic, ...rest } = row;
  return {
    ...rest,
    pse_clinic_name: clinicName
  };
}

async function enrichPatientsWithClinicNames(patients: Patient[]): Promise<Patient[]> {
  const missingClinicIds = [
    ...new Set(
      patients
        .filter((patient) => patient.clinic_id && !patient.pse_clinic_name?.trim())
        .map((patient) => patient.clinic_id as string)
    )
  ];

  if (!missingClinicIds.length) return patients;

  const { data, error } = await supabase.from('pse_clinics').select('id, name').in('id', missingClinicIds);
  if (error || !data?.length) return patients;

  const clinicNameById = new Map(
    data.map((row) => [row.id as string, (row.name as string | null)?.trim() || 'Clinic workspace'])
  );

  return patients.map((patient) => {
    if (!patient.clinic_id || patient.pse_clinic_name?.trim()) return patient;
    const clinicName = clinicNameById.get(patient.clinic_id);
    return clinicName ? { ...patient, pse_clinic_name: clinicName } : patient;
  });
}

const doctorAdminColumns = DOCTOR_PROFILE_COLUMNS;

type DoctorAdminRow = Doctor & { pse_clinics?: { name: string } | { name: string }[] | null };

function mapDoctorAdminRow(row: DoctorAdminRow): Doctor {
  const clinicRef = row.pse_clinics;
  const clinicName = Array.isArray(clinicRef) ? clinicRef[0]?.name : clinicRef?.name ?? null;
  const { pse_clinics: _clinic, ...rest } = row;
  return normalizeDoctor({
    ...rest,
    pse_clinic_name: clinicName
  } as Doctor);
}

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
  const result = await queryAdminSingle((query) =>
    query.eq('auth_user_id', authUserId).eq('is_active', true)
  );

  if (result.error) return { data: null, error: result.error };
  return { data: result.data ? normalizeAdmin(result.data as AdminRow) : null, error: null };
}

export async function fetchAdminByEmail(email: string) {
  const result = await queryAdminSingle((query) =>
    query.ilike('email', email.trim()).eq('is_active', true)
  );

  if (result.error) return { data: null, error: result.error };
  return { data: result.data ? normalizeAdmin(result.data as AdminRow) : null, error: null };
}

export async function fetchAllAdmins() {
  const result = await queryAdminList((query) => query.order('created_at', { ascending: true }));

  if (result.error) return { data: null, error: result.error };
  return { data: (result.data ?? []).map((row) => normalizeAdmin(row as AdminRow)), error: null };
}

export async function fetchPatientServiceExecutives(clinicOnly = false) {
  const role = clinicOnly ? 'patient_service_executive_clinic' : 'patient_service_executive';
  const result = await queryAdminList((query) =>
    query.eq('role', role).eq('is_active', true).order('full_name', { ascending: true })
  );

  if (result.error) {
    if (clinicOnly && isMissingClinicSchemaError(result.error)) {
      return { data: [], error: null };
    }
    return { data: null, error: result.error };
  }
  return { data: (result.data ?? []).map((row) => normalizeAdmin(row as AdminRow)), error: null };
}

export async function createPatientForAdmin(
  input: AdminPatientUpdateInput,
  options?: { clinicId?: string | null }
) {
  const row = {
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
    preferred_language: input.preferred_language.trim() || 'English',
    clinic_id: options?.clinicId ?? null,
    login_disabled: true
  };

  const { data, error } = await supabase.from('patients').insert(row).select(patientAdminColumns).single();

  if (error) {
    const message =
      error.code === '23505'
        ? 'A patient with this email already exists.'
        : error.message.includes('patients_insert_clinic_pse') || error.code === '42501'
          ? `${error.message} Run supabase/migrations/045_clinic_pse.sql (npm run db:apply-clinic-pse).`
          : error.message;
    return { data: null, error: { message } };
  }

  if (!data) {
    return { data: null, error: { message: 'Patient was created but could not be reloaded.' } };
  }

  return { data: data as Patient, error: null };
}

function normalizeAdmin(row: AdminRow): Admin {
  const clinicJoin = row.pse_clinics;
  const clinicName = Array.isArray(clinicJoin) ? clinicJoin[0]?.name ?? null : clinicJoin?.name ?? null;
  const role: Admin['role'] =
    row.role === 'patient_service_executive_clinic'
      ? 'patient_service_executive_clinic'
      : row.role === 'patient_service_executive'
        ? 'patient_service_executive'
        : 'administrator';

  return {
    id: row.id,
    auth_user_id: row.auth_user_id,
    email: row.email,
    full_name: row.full_name,
    role,
    clinic_id: row.clinic_id ?? null,
    clinic_name: clinicName,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function fetchAllPatientsForAdmin() {
  const withClinic = await supabase
    .from('patients')
    .select(patientAdminColumnsWithClinic)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (!withClinic.error) {
    const mapped = (withClinic.data ?? []).map((row) => mapPatientAdminRow(row as PatientAdminRow));
    const enriched = await enrichPatientsWithClinicNames(mapped);
    return {
      data: enriched,
      error: null
    };
  }

  if (!/deleted_at|column/.test(withClinic.error.message)) {
    return { data: null, error: withClinic.error };
  }

  const result = await supabase
    .from('patients')
    .select(patientAdminColumns)
    .order('created_at', { ascending: false });

  if (result.error) return { data: null, error: result.error };
  const enriched = await enrichPatientsWithClinicNames((result.data ?? []) as Patient[]);
  return { data: enriched, error: null };
}

export async function fetchAllDoctorsForAdmin() {
  const withClinic = await supabase
    .from('doctors')
    .select(`${doctorAdminColumns}, pse_clinics(name)`)
    .is('deleted_at', null)
    .order('full_name', { ascending: true });

  if (!withClinic.error) {
    return {
      data: (withClinic.data ?? []).map((row) => mapDoctorAdminRow(row as DoctorAdminRow)),
      error: null
    };
  }

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

export async function createDoctorForAdmin(
  input: AdminDoctorUpdateInput,
  options?: { clinicId?: string | null }
) {
  const row = {
    ...adminInputToDbRow(input),
    is_visible: true,
    clinic_id: options?.clinicId ?? null,
    login_disabled: false
  };

  const { data, error } = await supabase.from('doctors').insert(row).select(doctorAdminColumns).single();

  if (error) {
    const message = error.code === '23505'
      ? 'A doctor with this email already exists.'
      : error.message.includes('doctors_insert_admins') || error.code === '42501'
        ? `${error.message} Run supabase/migrations/028_doctors_insert_admins.sql (npm run db:apply-doctors-insert-admins).`
        : error.message;
    return { data: null, error: { message } };
  }

  if (!data) {
    return { data: null, error: { message: 'Doctor was created but could not be reloaded.' } };
  }

  return { data: normalizeDoctor(data as Doctor), error: null };
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

export async function deletePatientForAdmin(id: string) {
  const payload = {
    login_disabled: true,
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let { error: updateError, count } = await supabase
    .from('patients')
    .update(payload, { count: 'exact' })
    .eq('id', id)
    .is('deleted_at', null);

  if (updateError && /deleted_at|column/.test(updateError.message)) {
    ({ error: updateError, count } = await supabase
      .from('patients')
      .update(
        { login_disabled: true, updated_at: payload.updated_at },
        { count: 'exact' }
      )
      .eq('id', id));
  }

  if (updateError) return { error: updateError };
  if (count === 0) {
    return {
      error: {
        message:
          'No patient row was updated. The patient may already be deleted, or run migration 067_patient_soft_delete.sql (npm run db:apply-patient-soft-delete).'
      }
    };
  }
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
        message: 'This account is not authorized for ElixClinix staff.',
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
