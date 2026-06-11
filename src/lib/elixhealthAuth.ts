import type { AuthError } from '@supabase/supabase-js';
import { fetchAdminByAuthUserId, fetchAdminByEmail } from './admins';
import { fetchDoctorByAuthUserId, fetchDoctorByEmail } from './doctors';
import { supabase } from './supabase';
import type { Admin } from '../types/admin';
import type { Doctor } from '../types/doctor';

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

  let admin: Admin | null = (await fetchAdminByAuthUserId(user.id)).data;
  if (!admin && user.email) {
    admin = (await fetchAdminByEmail(user.email)).data;
  }

  if (admin) {
    return { error: null, admin, doctor: null };
  }

  let doctor: Doctor | null = (await fetchDoctorByAuthUserId(user.id)).data;
  if (!doctor && user.email) {
    doctor = (await fetchDoctorByEmail(user.email)).data;
  }

  if (!doctor) {
    await supabase.auth.signOut();
    return {
      error: {
        message: 'This account is not authorized for Elix Health.',
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
