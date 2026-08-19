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
import {
  assertEmailAvailableForSignup,
  cleanupPatientSignupOrphan,
  createTempSignupPassword,
  duplicateSignupAuthError,
  formatAuthEmailError,
  isConfirmationEmailSendError,
  isDuplicateSignupResponse,
  isAuthEmailRegistered,
  isExistingUserSignupError,
  LOGIN_NOT_REGISTERED_MESSAGE,
  resolveLoginCredentialError,
  resolveSignupEmailError,
  type SendSignupEmailOtpResult
} from '../lib/authEmailOtp';
import { startEmaillessPatientSignup } from '../lib/patientSignupPreconfirm';
import { getAuthRedirectUrl } from '../lib/authRedirect';
import { fetchDoctorByAuthUserId, fetchDoctorByEmail, fetchDoctorById } from '../lib/doctors';
import { claimPatientProfileForLogin, ensurePatientProfile, fetchPatientByAuthUserId, fetchPatientByEmail, isPatientLoginBlocked, PATIENT_LOGIN_BLOCKED_MESSAGE, patientLoginBlockedMessage } from '../lib/patients';
import { fetchAdminByAuthUserId } from '../lib/admins';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Doctor } from '../types/doctor';
import type { Patient, PatientUpsertInput } from '../types/patient';

type AppRole = 'patient' | 'doctor' | 'admin' | null;

export type SignInOptions = {
  /** Patient portal login: require an existing patient profile; reject other roles. */
  patientLoginOnly?: boolean;
};

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
    password: string,
    options?: SignInOptions
  ) => Promise<{
    error: AuthError | null;
    doctor: Doctor | null;
    patient: Patient | null;
    mustChangePassword: boolean;
  }>;
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
  updatePassword: (newPassword: string, options?: { clearForcePasswordChange?: boolean }) => Promise<{ error: AuthError | null }>;
  resendSignupConfirmation: (email: string) => Promise<{ error: AuthError | null }>;
  sendSignupEmailOtp: (email: string, fullName: string) => Promise<SendSignupEmailOtpResult>;
  resendSignupEmailOtp: (email: string) => Promise<{ error: AuthError | null }>;
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
    if (byEmail.data) {
      if (!byEmail.data.auth_user_id) {
        const { error: linkError } = await supabase
          .from('doctors')
          .update({ auth_user_id: user.id })
          .eq('id', byEmail.data.id)
          .is('auth_user_id', null);
        if (!linkError) {
          return { ...byEmail.data, auth_user_id: user.id };
        }
      }
      return byEmail.data;
    }
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

      // Performance: avoid fetching doctor+patient+admin on every session apply.
      // We use the role stored in user_metadata when available, and fall back to the
      // previous parallel fetch only when the role is missing/unknown.
      const metaRole = nextSession.user.user_metadata?.role as AppRole | undefined;

      let doctor: Doctor | null = null;
      let patient: Patient | null = null;
      let admin: any = null;

      if (metaRole === 'doctor') {
        doctor = await resolveDoctorForUser(nextSession.user);
      } else if (metaRole === 'patient') {
        patient = await resolvePatientForUser(nextSession.user);
      } else if (metaRole === 'admin') {
        admin = await fetchAdminByAuthUserId(nextSession.user.id).then((r) => r.data);
      } else {
        const result = await Promise.all([
          resolveDoctorForUser(nextSession.user),
          resolvePatientForUser(nextSession.user),
          fetchAdminByAuthUserId(nextSession.user.id).then((r) => r.data)
        ]);
        doctor = result[0];
        patient = result[1];
        admin = result[2];
      }

      if (patient && isPatientLoginBlocked(patient) && !admin && !doctor) {
        await supabase.auth.signOut();
        if (mounted) {
          setSession(null);
          setDoctorProfile(null);
          setPatientProfile(null);
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setDoctorProfile(doctor);
        setPatientProfile(admin ? null : patient);
        setLoading(false);
      }

      if (!doctor && !patient && !admin && nextSession.user.email) {
        const { data: authUser, error: authUserError } = await supabase.auth.getUser();
        // Only drop the session for definitive auth failures — not network blips.
        const hardFailure =
          authUserError &&
          (authUserError.status === 401 ||
            authUserError.status === 403 ||
            (authUserError.message ?? '').toLowerCase().includes('user from sub claim') ||
            (authUserError.message ?? '').toLowerCase().includes('session from session_id claim'));
        if (hardFailure || (!authUserError && !authUser.user)) {
          await supabase.auth.signOut();
          if (mounted) {
            setSession(null);
            setDoctorProfile(null);
            setPatientProfile(null);
          }
          return;
        }
        if (authUserError) {
          // Transient error: keep the Supabase session; profiles may resolve on next refresh.
          return;
        }

        // Claim an existing clinic profile only — never recreate a deleted patient row here.
        const claimed = await claimPatientProfileForLogin();
        if (claimed.error?.message === PATIENT_LOGIN_BLOCKED_MESSAGE || (claimed.data && isPatientLoginBlocked(claimed.data))) {
          await supabase.auth.signOut();
          if (mounted) {
            setSession(null);
            setDoctorProfile(null);
            setPatientProfile(null);
          }
          return;
        }
        if (mounted && claimed.data && !isPatientLoginBlocked(claimed.data)) {
          setPatientProfile(claimed.data);
        }
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

  // If PSE/admin disables or deletes the patient while they are signed in, force logout.
  // Staff/doctor sessions skip this poll. Transient network/auth glitches must not sign anyone out.
  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) return;

    let cancelled = false;
    const userId = session.user.id;

    const forceSignOut = async () => {
      await supabase.auth.signOut();
      if (!cancelled) {
        setSession(null);
        setDoctorProfile(null);
        setPatientProfile(null);
      }
    };

    const isDefinitiveAuthFailure = (error: { message?: string; status?: number; code?: string } | null) => {
      if (!error) return false;
      const status = error.status;
      const code = (error.code ?? '').toLowerCase();
      const message = (error.message ?? '').toLowerCase();
      // Session truly gone / banned user — not temporary network or rate-limit issues.
      if (status === 401 || status === 403) return true;
      if (code === 'user_not_found' || code === 'session_not_found') return true;
      if (message.includes('user from sub claim in jwt does not exist')) return true;
      if (message.includes('session from session_id claim in jwt does not exist')) return true;
      if (message.includes('invalid claim') && message.includes('session')) return true;
      return false;
    };

    const verifyPatientSessionStillValid = async () => {
      // Never run patient logout heuristics against staff or doctor accounts.
      const [doctor, adminResult] = await Promise.all([
        resolveDoctorForUser(session.user),
        fetchAdminByAuthUserId(userId)
      ]);
      if (cancelled) return;
      if (adminResult.data || doctor) return;

      const [patient, authUser] = await Promise.all([
        resolvePatientForUser(session.user),
        supabase.auth.getUser()
      ]);

      if (cancelled) return;

      if (authUser.error) {
        if (isDefinitiveAuthFailure(authUser.error)) {
          await forceSignOut();
        }
        return;
      }
      if (!authUser.data.user) {
        await forceSignOut();
        return;
      }

      if (patient && isPatientLoginBlocked(patient)) {
        await forceSignOut();
        return;
      }

      // Patient profile permanently deleted (or unlinked) while session is still open.
      if (!patient && patientProfile) {
        await forceSignOut();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void verifyPatientSessionStillValid();
      }
    };

    void verifyPatientSessionStillValid();
    document.addEventListener('visibilitychange', onVisibility);
    const intervalId = window.setInterval(() => {
      void verifyPatientSessionStillValid();
    }, 60_000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(intervalId);
    };
  }, [session?.user?.id, patientProfile?.id, patientProfile?.login_disabled, patientProfile?.deleted_at]);

  const signIn = useCallback(async (email: string, password: string, options?: SignInOptions) => {
    try {
      if (!isSupabaseConfigured) {
        return {
          error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError,
          doctor: null,
          patient: null,
          mustChangePassword: false
        };
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const message = await resolveLoginCredentialError(email, error);
        return {
          error: { ...error, message },
          doctor: null,
          patient: null,
          mustChangePassword: false
        };
      }

      const user = data.user;
      const doctor = user ? await resolveDoctorForUser(user) : null;
      const admin = user ? (await fetchAdminByAuthUserId(user.id)).data : null;
      let patient = user && !admin ? await resolvePatientForUser(user) : null;

      if (options?.patientLoginOnly) {
        if (doctor || admin) {
          await supabase.auth.signOut();
          return {
            error: {
              message: LOGIN_NOT_REGISTERED_MESSAGE,
              name: 'AuthError',
              status: 403
            } as AuthError,
            doctor: null,
            patient: null,
            mustChangePassword: false
          };
        }

        if (!patient) {
          const claimed = await claimPatientProfileForLogin();
          patient = claimed.data;
          if (!patient && claimed.error) {
            await supabase.auth.signOut();
            return {
              error: {
                message: claimed.error.message,
                name: 'AuthError',
                status: 500
              } as AuthError,
              doctor: null,
              patient: null,
              mustChangePassword: false
            };
          }
        }

        if (patient && isPatientLoginBlocked(patient)) {
          await supabase.auth.signOut();
          return {
            error: {
              message: patientLoginBlockedMessage(patient),
              name: 'AuthError',
              status: 403
            } as AuthError,
            doctor: null,
            patient: null,
            mustChangePassword: false
          };
        }

        if (!patient) {
          await supabase.auth.signOut();
          return {
            error: {
              message: LOGIN_NOT_REGISTERED_MESSAGE,
              name: 'AuthError',
              status: 403
            } as AuthError,
            doctor: null,
            patient: null,
            mustChangePassword: false
          };
        }
      } else if (user && !doctor && !patient && !admin) {
        const ensured = await ensurePatientProfile(user);
        patient = ensured.data;
        if (ensured.error?.message === PATIENT_LOGIN_BLOCKED_MESSAGE) {
          await supabase.auth.signOut();
          return {
            error: {
              message: PATIENT_LOGIN_BLOCKED_MESSAGE,
              name: 'AuthError',
              status: 403
            } as AuthError,
            doctor: null,
            patient: null,
            mustChangePassword: false
          };
        }
        if (!patient && ensured.error) {
          await supabase.auth.signOut();
          return {
            error: {
              message: `Signed in but patient profile failed: ${ensured.error.message}`,
              name: 'AuthError',
              status: 500
            } as AuthError,
            doctor: null,
            patient: null,
            mustChangePassword: false
          };
        }
      } else if (patient && isPatientLoginBlocked(patient) && !admin && !doctor) {
        await supabase.auth.signOut();
        return {
          error: {
            message: patientLoginBlockedMessage(patient),
            name: 'AuthError',
            status: 403
          } as AuthError,
          doctor: null,
          patient: null,
          mustChangePassword: false
        };
      }

      setSession(data.session);
      setDoctorProfile(doctor);
      setPatientProfile(admin ? null : patient);
      const mustChangePassword = Boolean(
        options?.patientLoginOnly &&
        patient &&
        user?.user_metadata &&
        typeof user.user_metadata === 'object' &&
        (user.user_metadata as Record<string, unknown>).force_password_change
      );
      return { error: null, doctor, patient, mustChangePassword };
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : 'Unexpected sign-in failure. Please try again.';
      await supabase.auth.signOut();
      return {
        error: {
          message,
          name: 'AuthError',
          status: 500
        } as AuthError,
        doctor: null,
        patient: null,
        mustChangePassword: false
      };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, profile?: Partial<PatientUpsertInput>) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError,
        patient: null,
        needsEmailConfirmation: false,
        profileSaved: false
      };
    }

    const emailUnavailable = await assertEmailAvailableForSignup(email);
    if (emailUnavailable) {
      return {
        error: emailUnavailable,
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
      if (isExistingUserSignupError(error)) {
        return {
          error: { ...error, message: formatAuthEmailError(error) } as AuthError,
          patient: null,
          needsEmailConfirmation: false,
          profileSaved: false
        };
      }
      return { error, patient: null, needsEmailConfirmation: false, profileSaved: false };
    }

    if (isDuplicateSignupResponse(data)) {
      return {
        error: duplicateSignupAuthError(),
        patient: null,
        needsEmailConfirmation: false,
        profileSaved: false
      };
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
      return { error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthRedirectUrl('/')
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (
    newPassword: string,
    options?: { clearForcePasswordChange?: boolean }
  ) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError };
    }
    const clearForcePasswordChange = options?.clearForcePasswordChange ?? true;
    const currentUser = session?.user;
    const existingMeta =
      currentUser?.user_metadata && typeof currentUser.user_metadata === 'object'
        ? (currentUser.user_metadata as Record<string, unknown>)
        : {};
    const metadataPatch = clearForcePasswordChange
      ? { ...existingMeta, force_password_change: false, temporary_password: false }
      : existingMeta;
    const { error } = await supabase.auth.updateUser({ password: newPassword, data: metadataPatch });
    return { error };
  }, [session?.user]);

  const resendSignupConfirmation = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError };
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: getAuthRedirectUrl('/') }
    });
    return { error };
  }, []);

  const sendSignupEmailOtp = useCallback(async (email: string, fullName: string): Promise<SendSignupEmailOtpResult> => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError };
    }

    const trimmedEmail = email.trim();
    const redirectTo = getAuthRedirectUrl('/');

    const emailUnavailable = await assertEmailAvailableForSignup(trimmedEmail);
    if (emailUnavailable) {
      return { error: emailUnavailable };
    }

    const attemptSignUp = () =>
      supabase.auth.signUp({
        email: trimmedEmail,
        password: createTempSignupPassword(),
        options: {
          emailRedirectTo: redirectTo,
          data: {
            role: 'patient',
            full_name: fullName.trim()
          }
        }
      });

    let { data, error } = await attemptSignUp();

    if (!error && isDuplicateSignupResponse(data)) {
      const cleaned = await cleanupPatientSignupOrphan(trimmedEmail);
      if (cleaned) {
        ({ data, error } = await attemptSignUp());
      }
    }

    if (error) {
      if (isConfirmationEmailSendError(error)) {
        const registered = await isAuthEmailRegistered(trimmedEmail);
        if (registered !== true) {
          const fallback = await startEmaillessPatientSignup(trimmedEmail, fullName.trim());
          if (fallback.bootstrapPassword) {
            const signIn = await supabase.auth.signInWithPassword({
              email: trimmedEmail,
              password: fallback.bootstrapPassword
            });
            if (!signIn.error && signIn.data.session) {
              setSession(signIn.data.session);
              return { error: null, skipVerification: true };
            }
          }
        }
      }

      return { error: await resolveSignupEmailError(trimmedEmail, error) };
    }

    if (isDuplicateSignupResponse(data)) {
      const registered = await isAuthEmailRegistered(trimmedEmail);
      if (registered === true) {
        return { error: duplicateSignupAuthError() };
      }
    }

    if (data.session) {
      setSession(data.session);
      return { error: null, skipVerification: true };
    }

    return { error: null };
  }, []);

  const resendSignupEmailOtp = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError };
    }

    const trimmedEmail = email.trim();
    const redirectTo = getAuthRedirectUrl('/');

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: trimmedEmail,
      options: { emailRedirectTo: redirectTo }
    });

    if (!resendError) return { error: null };

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo
      }
    });

    if (otpError) {
      return { error: { ...otpError, message: formatAuthEmailError(otpError) } as AuthError };
    }

    return { error: null };
  }, []);

  const verifyEmailOtp = useCallback(async (
    email: string,
    token: string,
    profile?: Partial<PatientUpsertInput>
  ) => {
    if (!isSupabaseConfigured) {
      return {
        error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError
      };
    }

    const trimmedEmail = email.trim();
    const trimmedToken = token.trim();

    let { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: 'signup'
    });

    if (error) {
      const fallback = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: 'email'
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
        error: { message: 'ElixClinix is not configured', name: 'AuthError', status: 500 } as AuthError,
        patient: null
      };
    }

    try {
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
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : 'Could not complete signup.';
      return {
        error: { message, name: 'AuthError', status: 500 } as AuthError,
        patient: null
      };
    }
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
      resendSignupEmailOtp,
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
      resendSignupEmailOtp,
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
