import type { AuthError } from '@supabase/supabase-js';
import type { Admin } from '../types/admin';
import type { AdminDoctorUpdateInput, Doctor } from '../types/doctor';
import type { Patient } from '../types/patient';
import { deletePatientPermanently } from './adminAuth';
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

/** Platform + clinic PSEs (for admin assignment dropdowns). */
export async function fetchAllAssignablePatientServiceExecutives() {
  const [platform, clinic] = await Promise.all([
    fetchPatientServiceExecutives(false),
    fetchPatientServiceExecutives(true)
  ]);

  if (platform.error) return { data: null, error: platform.error };
  if (clinic.error) return { data: null, error: clinic.error };

  const byId = new Map<string, Admin>();
  for (const executive of [...(platform.data ?? []), ...(clinic.data ?? [])]) {
    byId.set(executive.id, executive);
  }
  return {
    data: [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    error: null
  };
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
  const { error: updateError, count } = await supabase
    .from('doctors')
    .update(
      {
        is_visible: false,
        deleted_at: new Date().toISOString(),
        login_disabled: true
      },
      { count: 'exact' }
    )
    .eq('id', id)
    .is('deleted_at', null);

  if (updateError) {
    const msg = (updateError.message ?? '').toLowerCase();
    if (msg.includes('row-level security') || msg.includes('policy')) {
      return {
        error: {
          message:
            'Could not delete doctor due to database permissions. Apply migration 073_doctor_soft_delete_select_rls.sql (npm run db:apply-doctor-soft-delete-select-rls).'
        }
      };
    }
    return { error: updateError };
  }

  if (count === 0) {
    return {
      error: {
        message:
          'No doctor row was deleted. The doctor may already be removed, or soft-delete RLS is blocking the update (run npm run db:apply-doctor-soft-delete-select-rls).'
      }
    };
  }

  return { error: null };
}

/** Permanently delete a patient profile, login, and linked opinion requests. */
export async function deletePatientForAdmin(id: string) {
  const { data, error } = await deletePatientPermanently(id);
  if (error) return { error: { message: error }, deletedRequests: 0 };
  return { error: null, deletedRequests: data?.deletedRequests ?? 0 };
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

/**
 * Assign a platform (global) patient to a clinic PSE workspace.
 * Moves the patient out of the global pool and transfers their opinion requests
 * so the clinic PSE can manage cases going forward.
 */
export async function assignPatientToClinicForAdmin(patientId: string, clinicId: string) {
  const trimmedClinicId = clinicId.trim();
  if (!trimmedClinicId) {
    return { data: null, transferredRequests: 0, error: { message: 'Select a clinic workspace.' } };
  }

  const { data: clinic, error: clinicError } = await supabase
    .from('pse_clinics')
    .select('id, name')
    .eq('id', trimmedClinicId)
    .maybeSingle();

  if (clinicError) {
    return { data: null, transferredRequests: 0, error: { message: clinicError.message } };
  }
  if (!clinic) {
    return { data: null, transferredRequests: 0, error: { message: 'Clinic workspace not found.' } };
  }

  const now = new Date().toISOString();
  const { error: updateError, count } = await supabase
    .from('patients')
    .update({ clinic_id: trimmedClinicId, updated_at: now }, { count: 'exact' })
    .eq('id', patientId);

  if (updateError) {
    return { data: null, transferredRequests: 0, error: { message: updateError.message } };
  }
  if (count === 0) {
    return {
      data: null,
      transferredRequests: 0,
      error: {
        message:
          'Could not assign patient. Ensure you are signed in as administrator and clinic patient visibility is applied (npm run db:apply-admin-clinic-patients).'
      }
    };
  }

  const { data: patientRow, error: fetchError } = await supabase
    .from('patients')
    .select(patientAdminColumnsWithClinic)
    .eq('id', patientId)
    .maybeSingle();

  if (fetchError) {
    return { data: null, transferredRequests: 0, error: { message: fetchError.message } };
  }
  if (!patientRow) {
    return {
      data: null,
      transferredRequests: 0,
      error: { message: 'Patient was assigned but could not be reloaded.' }
    };
  }

  const patient = mapPatientAdminRow(patientRow as PatientAdminRow);
  let transferredRequests = 0;

  if (patient.auth_user_id) {
    const { data: requestRows, error: requestError } = await supabase
      .from('opinion_requests')
      .update({
        clinic_id: trimmedClinicId,
        assigned_to: null
      })
      .eq('patient_id', patient.auth_user_id)
      .select('id');

    if (requestError) {
      return {
        data: patient,
        transferredRequests: 0,
        error: {
          message: `Patient assigned to ${clinic.name}, but transferring requests failed: ${requestError.message}`
        }
      };
    }
    transferredRequests = requestRows?.length ?? 0;
  }

  return {
    data: {
      ...patient,
      clinic_id: trimmedClinicId,
      pse_clinic_name: patient.pse_clinic_name?.trim() || clinic.name
    },
    transferredRequests,
    error: null
  };
}

/**
 * Remove a patient from a clinic PSE workspace back to the Global (platform) pool.
 * Moves their opinion requests back to platform scope.
 */
export async function removePatientFromClinicForAdmin(patientId: string) {
  const now = new Date().toISOString();
  const { error: updateError, count } = await supabase
    .from('patients')
    .update({ clinic_id: null, updated_at: now }, { count: 'exact' })
    .eq('id', patientId)
    .not('clinic_id', 'is', null);

  if (updateError) {
    return { data: null, transferredRequests: 0, error: { message: updateError.message } };
  }
  if (count === 0) {
    return {
      data: null,
      transferredRequests: 0,
      error: {
        message:
          'Could not remove clinic assignment. The patient may already be global, or you need administrator access (npm run db:apply-admin-clinic-patients).'
      }
    };
  }

  const { data: patientRow, error: fetchError } = await supabase
    .from('patients')
    .select(patientAdminColumnsWithClinic)
    .eq('id', patientId)
    .maybeSingle();

  if (fetchError) {
    return { data: null, transferredRequests: 0, error: { message: fetchError.message } };
  }
  if (!patientRow) {
    return {
      data: null,
      transferredRequests: 0,
      error: { message: 'Clinic assignment was removed but the patient could not be reloaded.' }
    };
  }

  const patient = mapPatientAdminRow(patientRow as PatientAdminRow);
  let transferredRequests = 0;

  if (patient.auth_user_id) {
    const { data: requestRows, error: requestError } = await supabase
      .from('opinion_requests')
      .update({
        clinic_id: null,
        assigned_to: null
      })
      .eq('patient_id', patient.auth_user_id)
      .select('id');

    if (requestError) {
      return {
        data: { ...patient, clinic_id: null, pse_clinic_name: null },
        transferredRequests: 0,
        error: {
          message: `Patient returned to Global, but transferring requests failed: ${requestError.message}`
        }
      };
    }
    transferredRequests = requestRows?.length ?? 0;
  }

  return {
    data: { ...patient, clinic_id: null, pse_clinic_name: null },
    transferredRequests,
    error: null
  };
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
