import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { fetchDoctorByAuthUserId, fetchDoctorByEmail, fetchDoctorById } from '../lib/doctors';
import { ensurePatientProfile, fetchPatientByAuthUserId, fetchPatientByEmail } from '../lib/patients';
import { fetchAdminByAuthUserId } from '../lib/admins';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Doctor } from '../types/doctor';
import type { Patient, PatientUpsertInput } from '../types/patient';

type AppRole = 'patient' | 'doctor' | 'admin' | null;

type SupabaseContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  doctorProfile: Doctor | null;
  patientProfile: Patient | null;
  appRole: AppRole;
  isDoctor: boolean;
  isPatient: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null; doctor: Doctor | null; patient: Patient | null }>;
  signUp: (
    email: string,
    password: string,
    profile?: Partial<PatientUpsertInput>
  ) => Promise<{
    error: AuthError | null;
    patient: Patient | null;
    needsEmailConfirmation: boolean;
    profileSaved: boolean;
  }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  resendSignupConfirmation: (email: string) => Promise<{ error: AuthError | null }>;
  sendSignupEmailOtp: (email: string, fullName: string) => Promise<{ error: AuthError | null }>;
  verifyEmailOtp: (
    email: string,
    token: string,
    profile?: Partial<PatientUpsertInput>
  ) => Promise<{ error: AuthError | null }>;
  completeSignupWithPassword: (
    password: string,
    profile: Partial<PatientUpsertInput>
  ) => Promise<{ error: AuthError | null; patient: Patient | null }>;
  verifySignupOtp: (
    email: string,
    token: string,
    profile?: Partial<PatientUpsertInput>
  ) => Promise<{ error: AuthError | null; patient: Patient | null }>;
  refreshDoctorProfile: () => Promise<Doctor | null>;
  refreshPatientProfile: () => Promise<Patient | null>;
  ensurePatientProfile: (profile?: Partial<PatientUpsertInput>) => Promise<Patient | null>;
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

async function resolveDoctorForUser(user: User | null): Promise<Doctor | null> {
  if (!user) return null;

  if (user.id) {
    const byAuth = await fetchDoctorByAuthUserId(user.id);
    if (byAuth.data) return byAuth.data;
  }

  if (user.email) {
    const byEmail = await fetchDoctorByEmail(user.email);
    if (byEmail.data) return byEmail.data;
  }

  const metaRole = user.user_metadata?.role;
  if (metaRole === 'doctor' && user.user_metadata?.doctor_id) {
    const byId = await fetchDoctorById(String(user.user_metadata.doctor_id));
    if (byId.data) return byId.data;
  }

  return null;
}

async function resolvePatientForUser(user: User | null): Promise<Patient | null> {
  if (!user) return null;

  if (user.id) {
    const byAuth = await fetchPatientByAuthUserId(user.id);
    if (byAuth.data) return byAuth.data;
  }

  if (user.email) {
    const byEmail = await fetchPatientByEmail(user.email);
    if (byEmail.data) return byEmail.data;
  }

  return null;
}

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [patientProfile, setPatientProfile] = useState<Patient | null>(null);

  const refreshDoctorProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !session?.user) {
      setDoctorProfile(null);
      return null;
    }
    const doctor = await resolveDoctorForUser(session.user);
    setDoctorProfile(doctor);
    return doctor;
  }, [session?.user]);

  const refreshPatientProfile = useCallback(async () => {
    if (!isSupabaseConfigured || !session?.user) {
      setPatientProfile(null);
      return null;
    }
    const patient = await resolvePatientForUser(session.user);
    setPatientProfile(patient);
    return patient;
  }, [session?.user]);

  const ensurePatientProfileForSession = useCallback(
    async (profile?: Partial<PatientUpsertInput>) => {
      if (!session?.user) return null;
      const ensured = await ensurePatientProfile(session.user, profile);
      if (ensured.data) setPatientProfile(ensured.data);
      return ensured.data;
    },
    [session?.user]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setDoctorProfile(null);
      setPatientProfile(null);
      return;
    }

    let mounted = true;

    const applySession = async (nextSession: Session | null) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setDoctorProfile(null);
        setPatientProfile(null);
        setLoading(false);
        return;
      }

      const [doctor, patient, admin] = await Promise.all([
        resolveDoctorForUser(nextSession.user),
        resolvePatientForUser(nextSession.user),
        fetchAdminByAuthUserId(nextSession.user.id).then((r) => r.data)
      ]);

      if (mounted) {
        setDoctorProfile(doctor);
        setPatientProfile(admin ? null : patient);
        setLoading(false);
      }

      if (!doctor && !patient && !admin && nextSession.user.email) {
        const ensured = await ensurePatientProfile(nextSession.user);
        if (mounted && ensured.data) setPatientProfile(ensured.data);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      void applySession(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError,
        doctor: null,
        patient: null
      };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error, doctor: null, patient: null };

    const user = data.user;
    const doctor = user ? await resolveDoctorForUser(user) : null;
    const admin = user ? (await fetchAdminByAuthUserId(user.id)).data : null;
    let patient = user && !admin ? await resolvePatientForUser(user) : null;

    if (user && !doctor && !patient && !admin) {
      const ensured = await ensurePatientProfile(user);
      patient = ensured.data;
      if (!patient && ensured.error) {
        await supabase.auth.signOut();
        return {
          error: {
            message: `Signed in but patient profile failed: ${ensured.error.message}`,
            name: 'AuthError',
            status: 500
          } as AuthError,
          doctor: null,
          patient: null
        };
      }
    }

    setSession(data.session);
    setDoctorProfile(doctor);
    setPatientProfile(patient);
    return { error: null, doctor, patient };
  }, []);

  const signUp = useCallback(async (email: string, password: string, profile?: Partial<PatientUpsertInput>) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError,
        patient: null,
        needsEmailConfirmation: false,
        profileSaved: false
      };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/'),
        data: {
          role: 'patient',
          full_name: profile?.full_name ?? email.split('@')[0]
        }
      }
    });

    if (error) {
      return { error, patient: null, needsEmailConfirmation: false, profileSaved: false };
    }

    const needsEmailConfirmation = Boolean(data.user && !data.session);

    let patient: Patient | null = null;
    let profileSaved = false;

    if (data.user && data.session) {
      const ensured = await ensurePatientProfile(data.user, { email, ...profile });
      patient = ensured.data;
      profileSaved = Boolean(ensured.data);
      if (ensured.error) {
        return {
          error: {
            message: `Account created but patient profile failed: ${ensured.error.message}`,
            name: 'AuthError',
            status: 500
          } as AuthError,
          patient: null,
          needsEmailConfirmation: false,
          profileSaved: false
        };
      }
      setPatientProfile(patient);
    }

    if (data.session) setSession(data.session);
    return { error: null, patient, needsEmailConfirmation, profileSaved };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setDoctorProfile(null);
    setPatientProfile(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthRedirectUrl('/')
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  }, []);

  const resendSignupConfirmation = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError };
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: getAuthRedirectUrl('/') }
    });
    return { error };
  }, []);

  const sendSignupEmailOtp = useCallback(async (email: string, fullName: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: {
          role: 'patient',
          full_name: fullName.trim()
        }
      }
    });

    return { error };
  }, []);

  const verifyEmailOtp = useCallback(async (
    email: string,
    token: string,
    profile?: Partial<PatientUpsertInput>
  ) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError
      };
    }

    const trimmedEmail = email.trim();
    const trimmedToken = token.trim();

    let { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: 'email'
    });

    if (error) {
      const fallback = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: 'signup'
      });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return { error };

    const user = data.user;
    if (!user) {
      return {
        error: {
          message: 'Verification failed. Check the code and try again.',
          name: 'AuthError',
          status: 400
        } as AuthError
      };
    }

    if (data.session) setSession(data.session);

    if (profile?.full_name) {
      await supabase.auth.updateUser({
        data: {
          role: 'patient',
          full_name: profile.full_name
        }
      });
    }

    return { error: null };
  }, []);

  const completeSignupWithPassword = useCallback(async (
    password: string,
    profile: Partial<PatientUpsertInput>
  ) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError,
        patient: null
      };
    }

    const { data, error } = await supabase.auth.updateUser({
      password,
      data: {
        role: 'patient',
        full_name: profile.full_name ?? profile.email?.split('@')[0] ?? 'Patient'
      }
    });

    if (error) return { error, patient: null };

    const user = data.user;
    if (!user) {
      return {
        error: { message: 'Could not save password.', name: 'AuthError', status: 500 } as AuthError,
        patient: null
      };
    }

    const ensured = await ensurePatientProfile(user, profile);
    if (ensured.error) {
      return {
        error: {
          message: `Password saved but patient profile failed: ${ensured.error.message}`,
          name: 'AuthError',
          status: 500
        } as AuthError,
        patient: null
      };
    }

    if (ensured.data) setPatientProfile(ensured.data);
    return { error: null, patient: ensured.data };
  }, []);

  const verifySignupOtp = useCallback(async (
    email: string,
    token: string,
    profile?: Partial<PatientUpsertInput>
  ) => {
    const verified = await verifyEmailOtp(email, token, profile);
    if (verified.error) return { error: verified.error, patient: null };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        error: { message: 'Verification failed.', name: 'AuthError', status: 400 } as AuthError,
        patient: null
      };
    }

    const ensured = await ensurePatientProfile(user, { email: email.trim(), ...profile });
    if (ensured.error) {
      return {
        error: {
          message: `Email verified but patient profile failed: ${ensured.error.message}`,
          name: 'AuthError',
          status: 500
        } as AuthError,
        patient: null
      };
    }

    if (ensured.data) setPatientProfile(ensured.data);
    return { error: null, patient: ensured.data };
  }, [verifyEmailOtp]);

  const appRole: AppRole = doctorProfile ? 'doctor' : patientProfile || session ? 'patient' : null;

  const value = useMemo<SupabaseContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      doctorProfile,
      patientProfile,
      appRole,
      isDoctor: Boolean(doctorProfile),
      isPatient: Boolean(patientProfile) || (Boolean(session) && !doctorProfile),
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendSignupConfirmation,
      sendSignupEmailOtp,
      verifyEmailOtp,
      completeSignupWithPassword,
      verifySignupOtp,
      refreshDoctorProfile,
      refreshPatientProfile,
      ensurePatientProfile: ensurePatientProfileForSession
    }),
    [
      loading,
      session,
      doctorProfile,
      patientProfile,
      appRole,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendSignupConfirmation,
      sendSignupEmailOtp,
      verifyEmailOtp,
      completeSignupWithPassword,
      verifySignupOtp,
      refreshDoctorProfile,
      refreshPatientProfile,
      ensurePatientProfileForSession
    ]
  );

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider');
  }
  return context;
}
