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
import { fetchDoctorByAuthUserId, fetchDoctorByEmail, fetchDoctorById } from '../lib/doctors';
import { ensurePatientProfile, fetchPatientByAuthUserId, fetchPatientByEmail } from '../lib/patients';
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
  ) => Promise<{ error: AuthError | null; patient: Patient | null }>;
  signOut: () => Promise<void>;
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

      const [doctor, patient] = await Promise.all([
        resolveDoctorForUser(nextSession.user),
        resolvePatientForUser(nextSession.user)
      ]);

      if (mounted) {
        setDoctorProfile(doctor);
        setPatientProfile(patient);
        setLoading(false);
      }

      if (!doctor && !patient && nextSession.user.email) {
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
    let patient = user ? await resolvePatientForUser(user) : null;

    if (user && !doctor && !patient) {
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
      return { error: { message: 'Supabase is not configured', name: 'AuthError', status: 500 } as AuthError, patient: null };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'patient',
          full_name: profile?.full_name ?? email.split('@')[0]
        }
      }
    });

    if (error) return { error, patient: null };

    let patient: Patient | null = null;
    if (data.user) {
      const ensured = await ensurePatientProfile(data.user, { email, ...profile });
      patient = ensured.data;
      setPatientProfile(patient);
    }

    if (data.session) setSession(data.session);
    return { error: null, patient };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setDoctorProfile(null);
    setPatientProfile(null);
  }, []);

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
