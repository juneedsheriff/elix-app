import type { AuthError } from '@supabase/supabase-js';
import { fetchAdminByAuthUserId, fetchAdminByEmail } from './admins';
import { fetchDoctorByAuthUserId, fetchDoctorByEmail } from './doctors';
import { supabase } from './supabase';
import type { Admin } from '../types/admin';
import type { Doctor } from '../types/doctor';

const STAFF_AUTH_ROLES = new Set([
  'admin',
  'administrator',
  'patient_service_executive',
  'patient_service_executive_clinic'
]);

async function resolveStaffAdmin(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  let admin: Admin | null = (await fetchAdminByAuthUserId(user.id)).data;
  if (admin || !user.email) return admin;

  admin = (await fetchAdminByEmail(user.email)).data;
  if (admin) return admin;

  const staffRole = user.user_metadata?.staff_role ?? user.user_metadata?.role;
  if (typeof staffRole === 'string' && STAFF_AUTH_ROLES.has(staffRole)) {
    admin = (await fetchAdminByEmail(user.email)).data;
  }

  return admin;
}

export async function elixhealthSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) {
    return { error, admin: null as Admin | null, doctor: null as Doctor | null };
  }

  const user = data.user;
  if (!user) {
    return {
      error: { message: 'Sign in failed', name: 'AuthError', status: 500 } as AuthError,
      admin: null,
      doctor: null
    };
  }

  const admin = await resolveStaffAdmin(user);
  if (admin) {
    return { error: null, admin, doctor: null };
  }

  let doctor: Doctor | null = (await fetchDoctorByAuthUserId(user.id)).data;
  if (!doctor && user.email) {
    doctor = (await fetchDoctorByEmail(user.email)).data;
    // Link auth so RLS / medical-records worker resolve the same doctor profile.
    if (doctor && !doctor.auth_user_id) {
      const { error: linkError } = await supabase
        .from('doctors')
        .update({ auth_user_id: user.id })
        .eq('id', doctor.id)
        .is('auth_user_id', null);
      if (!linkError) {
        doctor = { ...doctor, auth_user_id: user.id };
      }
    }
  }

  if (!doctor) {
    await supabase.auth.signOut();
    return {
      error: {
        message: 'This account is not authorized for ElixClinix.',
        name: 'AuthError',
        status: 403
      } as AuthError,
      admin: null,
      doctor: null
    };
  }

  if (doctor.login_disabled) {
    await supabase.auth.signOut();
    return {
      error: {
        message: 'Doctor login has been disabled. Contact your administrator.',
        name: 'AuthError',
        status: 403
      } as AuthError,
      admin: null,
      doctor: null
    };
  }

  return { error: null, admin: null, doctor };
}
