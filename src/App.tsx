import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from './layout/AppShell';
import AuthPage, { type LoginMode } from './pages/auth/AuthPage';
import ChatPatientOnboarding from './components/auth/ChatPatientOnboarding';
import { completePatientOnboarding } from './lib/patients';
import { isPatientProfileComplete } from './lib/patientProfileCompleteness';
import OnboardingPage from './pages/auth/OnboardingPage';
import SplashPage from './pages/auth/SplashPage';
import { getNavItems, TRANSLATIONS, type Language, type Role as AppRole } from './i18n/appTranslations';
import { getBottomTabs } from './lib/navigation/bottomTabs';
import {
  appScreenPath,
  consumeReturnScreen,
  parseAppScreenPath,
  resolveScreenForRole,
  saveReturnScreen
} from './lib/navigation/appRoutes';
import { clearAuthSurface, getAuthSurface, setAuthSurface } from './lib/navigation/authSurface';
import { ELIX_HEALTH_PATHS } from './pages/admin/elixHealthRoutes';
import { useSupabase } from './context/SupabaseProvider';
import {
  authHashErrorMessage,
  clearAuthHashFromUrl,
  isPasswordRecoveryCallback,
  parseAuthHashError
} from './lib/authRedirect';
import { supabase } from './lib/supabase';

type Role = AppRole;
type Theme = 'light' | 'dark';
type Stage = 'splash' | 'onboarding' | 'auth' | 'profile-setup' | 'app';
type AuthView = 'signin' | 'signup';

const DEFAULT_PASSWORD_HINT = 'Elix@123';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevStageRef = useRef<Stage>('splash');

  const {
    configured,
    loading: authLoading,
    session,
    user,
    doctorProfile,
    patientProfile,
    isDoctor,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    resendSignupConfirmation,
    sendSignupEmailOtp,
    resendSignupEmailOtp,
    verifyEmailOtp,
    completeSignupWithPassword,
    refreshPatientProfile
  } = useSupabase();

  const [theme, setTheme] = useState<Theme>('light');
  const [role, setRole] = useState<Role>('patient');
  const [loginMode, setLoginMode] = useState<LoginMode>('patient');
  const [stage, setStage] = useState<Stage>('splash');
  const [language, setLanguage] = useState<Language>('en');
  const [activeScreen, setActiveScreen] = useState<string>(() =>
    parseAppScreenPath(window.location.pathname) ?? 'patient-dashboard'
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authView, setAuthView] = useState<AuthView>('signin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  const copy = useMemo(() => TRANSLATIONS[language], [language]);
  const bottomTabs = useMemo(() => getBottomTabs(role, language), [role, language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const goToScreen = useCallback(
    (screenId: string) => {
      const resolved = resolveScreenForRole(role, screenId);
      setActiveScreen(resolved);
      setMenuOpen(false);
      if (stage === 'app') {
        navigate(appScreenPath(resolved));
      }
    },
    [role, stage, navigate]
  );

  useEffect(() => {
    const resolved = resolveScreenForRole(role, activeScreen);
    if (resolved !== activeScreen) {
      setActiveScreen(resolved);
      if (stage === 'app') {
        navigate(appScreenPath(resolved), { replace: true });
      }
    }
    setMenuOpen(false);
  }, [role, language, activeScreen, stage, navigate]);

  useEffect(() => {
    if (stage === 'app') return;
    const fromUrl = parseAppScreenPath(location.pathname);
    if (fromUrl) {
      saveReturnScreen(fromUrl);
      if (!location.pathname.startsWith('/auth')) {
        navigate('/auth', { replace: true });
      }
    }
  }, [stage, location.pathname, navigate]);

  useEffect(() => {
    if (stage !== 'app') return;
    const fromUrl = parseAppScreenPath(location.pathname);
    if (!fromUrl) return;
    const resolved = resolveScreenForRole(role, fromUrl);
    if (resolved !== activeScreen) {
      setActiveScreen(resolved);
    }
  }, [location.pathname, stage, role, activeScreen]);

  useEffect(() => {
    const prev = prevStageRef.current;
    if (prev !== 'app' && stage === 'app') {
      const fromUrl = parseAppScreenPath(location.pathname);
      const saved = consumeReturnScreen();
      const resolved = resolveScreenForRole(role, saved ?? fromUrl ?? activeScreen);
      setActiveScreen(resolved);
      const path = appScreenPath(resolved);
      if (location.pathname !== path) {
        navigate(path, { replace: true });
      }
    }
    prevStageRef.current = stage;
  }, [stage, role, activeScreen, location.pathname, navigate]);

  useEffect(() => {
    if (stage !== 'splash') return;
    const timeout = window.setTimeout(() => {
      if (configured && session) {
        if (isDoctor && getAuthSurface() === 'desktop') {
          navigate(ELIX_HEALTH_PATHS.workspace, { replace: true });
          return;
        }
        setStage('app');
      } else {
        setStage('onboarding');
      }
    }, 1700);
    return () => window.clearTimeout(timeout);
  }, [stage, configured, session, isDoctor, navigate]);

  useEffect(() => {
    if (authLoading || !session || isDoctor) return;
    if (stage !== 'auth' && stage !== 'onboarding') return;
    if (stage === 'auth' && authView === 'signup') return;

    setRole('patient');
    setLoginMode('patient');
    if (patientProfile && !isPatientProfileComplete(patientProfile)) {
      setStage('profile-setup');
      return;
    }
    if (patientProfile) {
      setStage('app');
    }
  }, [authLoading, session, isDoctor, patientProfile, stage, authView]);

  useEffect(() => {
    if (authLoading || !isDoctor || !doctorProfile) return;
    if (getAuthSurface() === 'desktop') {
      navigate(ELIX_HEALTH_PATHS.workspace, { replace: true });
      return;
    }
    setRole('doctor');
    const fromUrl = parseAppScreenPath(location.pathname);
    const resolved = resolveScreenForRole('doctor', fromUrl ?? activeScreen);
    if (resolved !== activeScreen) {
      setActiveScreen(resolved);
      if (stage === 'app') {
        navigate(appScreenPath(resolved), { replace: true });
      }
    }
  }, [authLoading, isDoctor, doctorProfile, location.pathname, activeScreen, stage, navigate]);

  useEffect(() => {
    if (!configured) {
      setDbConnected(false);
      return;
    }
    supabase.auth.getSession().then(({ error }) => {
      setDbConnected(!error);
    });
  }, [configured, session]);

  useEffect(() => {
    if (!configured) return;

    const hashError = parseAuthHashError();
    if (hashError) {
      setStage('auth');
      setPasswordRecovery(false);
      setAuthError(authHashErrorMessage(hashError.code, hashError.description));
      setAuthSuccess(null);
      clearAuthHashFromUrl();
      return;
    }

    if (isPasswordRecoveryCallback()) {
      setStage('auth');
      setPasswordRecovery(true);
      setAuthError(null);
      setAuthSuccess('Choose a new password below.');
      return;
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStage('auth');
        setPasswordRecovery(true);
        setAuthError(null);
        setAuthSuccess('Choose a new password below.');
        clearAuthHashFromUrl();
      }
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const clearAuthForm = () => {
    setEmail('');
    setPassword('');
    setAuthError(null);
    setAuthSuccess(null);
    setPasswordRecovery(false);
    setAuthView('signin');
  };

  const handleLoginModeChange = (mode: LoginMode) => {
    if (mode === loginMode) return;
    setLoginMode(mode);
    setEmail('');
    setPassword('');
    setAuthError(null);
    setAuthSuccess(null);
  };

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!email.trim() || !password) {
      setAuthError('Enter email and password.');
      return;
    }
    setAuthBusy(true);
    const { error, doctor, patient } = await signIn(email.trim(), password, {
      patientLoginOnly: loginMode === 'patient'
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    if (loginMode === 'doctor' && !doctor) {
      await signOut();
      setAuthError('No doctor account found for this email. Use a doctor @elixapp.health address.');
      return;
    }
    const nextRole = doctor ? 'doctor' : 'patient';
    setRole(nextRole);
    if (nextRole === 'doctor') {
      setAuthSurface('mobile');
    }
    const saved = consumeReturnScreen();
    const fromUrl = parseAppScreenPath(location.pathname);
    const screen = resolveScreenForRole(nextRole, saved ?? fromUrl);
    setActiveScreen(screen);

    if (nextRole === 'patient' && patient && !isPatientProfileComplete(patient)) {
      setStage('profile-setup');
      setAuthError(null);
      return;
    }

    setStage('app');
    navigate(appScreenPath(screen), { replace: true });
    setAuthError(null);
  };

  const handleForgotPassword = async () => {
    if (!configured) {
      setAuthError('Connect Supabase in .env.local first.');
      setAuthSuccess(null);
      return;
    }
    if (!email.trim()) {
      setAuthError('Enter your email first.');
      setAuthSuccess(null);
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthSuccess(null);
    const { error } = await requestPasswordReset(email.trim());
    setAuthBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('error sending recovery') || msg.includes('error sending confirmation')) {
        setAuthError(
          'Email could not be sent. Custom SMTP (Resend) may be misconfigured — verify the sender domain in Resend and run npm run db:apply-auth-smtp.'
        );
      } else {
        setAuthError(error.message);
      }
      return;
    }
    setAuthSuccess(
      `Password reset email sent to ${email.trim()}. Open the link on this device, then set a new password.`
    );
  };

  const handleSetNewPassword = async (newPassword: string, confirmPassword: string) => {
    if (!newPassword || newPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      setAuthSuccess(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError('Passwords do not match.');
      setAuthSuccess(null);
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    const { error } = await updatePassword(newPassword);
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setPasswordRecovery(false);
    setPassword('');
    setAuthSuccess('Password updated. Sign in with your new password.');
    void signOut();
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setAuthError('Enter your email first, then resend the confirmation link.');
      return;
    }
    setAuthBusy(true);
    const { error } = await resendSignupConfirmation(email.trim());
    setAuthBusy(false);
    setAuthError(
      error
        ? error.message
        : `Confirmation email sent to ${email.trim()}. Open the newest link (older links expire).`
    );
  };

  const handleSignOut = async () => {
    clearAuthSurface();
    await signOut();
    setStage('auth');
    navigate('/auth', { replace: true });
  };

  const handleSendEmailOtp = async (emailAddress: string, fullName: string) => {
    setAuthBusy(true);
    const { error, skipVerification } = await sendSignupEmailOtp(emailAddress, fullName);
    setAuthBusy(false);
    return { error: error?.message ?? null, skipVerification: Boolean(skipVerification) };
  };

  const handleResendEmailOtp = async (emailAddress: string) => {
    setAuthBusy(true);
    const { error } = await resendSignupEmailOtp(emailAddress);
    setAuthBusy(false);
    return { error: error?.message ?? null };
  };

  const handleVerifyEmailCode = async (emailAddress: string, code: string, fullName: string) => {
    setAuthBusy(true);
    const { error } = await verifyEmailOtp(emailAddress, code, {
      full_name: fullName,
      email: emailAddress,
      preferred_language: language
    });
    setAuthBusy(false);
    if (error) return { error: error.message };
    setRole('patient');
    setLoginMode('patient');
    return { error: null };
  };

  const handleSetSignupPassword = async (password: string, fullName: string, emailAddress: string) => {
    setAuthBusy(true);
    const { error } = await completeSignupWithPassword(password, {
      full_name: fullName,
      email: emailAddress,
      preferred_language: language
    });
    setAuthBusy(false);
    if (error) return { error: error.message };
    await refreshPatientProfile();
    return { error: null };
  };

  const handleCompleteProfile = async (input: {
    phone: string;
    gender: string;
    date_of_birth: string;
    address: string;
    blood_group: string;
    height_cm?: number | null;
    weight_kg?: number | null;
  }) => {
    if (!user?.id) return { error: 'Sign in to continue.' };

    setAuthBusy(true);
    const { error } = await completePatientOnboarding(user.id, input);
    setAuthBusy(false);

    if (error) return { error: error.message };
    await refreshPatientProfile();
    return { error: null };
  };

  const finishProfileSetup = () => {
    const screen = resolveScreenForRole('patient', parseAppScreenPath(location.pathname) ?? 'patient-dashboard');
    setActiveScreen(screen);
    setStage('app');
    navigate(appScreenPath(screen), { replace: true });
  };

  const openProfileSetup = () => {
    setStage('profile-setup');
  };

  return (
    <main className='app'>
      {stage === 'splash' ? <SplashPage welcome={copy.welcome} tagline={copy.tagline} /> : null}

      {stage === 'onboarding' ? (
        <OnboardingPage
          welcome={copy.welcome}
          tagline={copy.tagline}
          items={copy.onboard}
          skipLabel={copy.skip}
          continueLabel={copy.continue}
          onSkip={() => setStage('auth')}
          onContinue={() => setStage('auth')}
        />
      ) : null}

      {stage === 'auth' && authView === 'signup' && !passwordRecovery ? (
        <ChatPatientOnboarding
          mode='signup'
          configured={configured}
          authBusy={authBusy}
          session={session}
          patientProfile={patientProfile}
          onSendEmailOtp={handleSendEmailOtp}
          onSetPassword={handleSetSignupPassword}
          onCompleteProfile={handleCompleteProfile}
          onResendEmailOtp={handleResendEmailOtp}
          onVerifyEmailCode={handleVerifyEmailCode}
          onBack={() => {
            setAuthView('signin');
            setAuthError(null);
            setAuthSuccess(null);
          }}
          onFinished={finishProfileSetup}
        />
      ) : null}

      {stage === 'profile-setup' ? (
        <ChatPatientOnboarding
          mode='profile-only'
          configured={configured}
          authBusy={authBusy}
          session={session}
          patientProfile={patientProfile}
          onSendEmailOtp={handleSendEmailOtp}
          onSetPassword={handleSetSignupPassword}
          onCompleteProfile={handleCompleteProfile}
          onResendEmailOtp={handleResendEmailOtp}
          onVerifyEmailCode={handleVerifyEmailCode}
          onBack={() => {
            if (session) {
              finishProfileSetup();
              return;
            }
            setStage('auth');
          }}
          onFinished={finishProfileSetup}
        />
      ) : null}

      {stage === 'auth' && (authView === 'signin' || passwordRecovery) ? (
        <AuthPage
          loginMode={loginMode}
          configured={configured}
          passwordRecovery={passwordRecovery}
          email={email}
          password={password}
          authError={authError}
          authSuccess={authSuccess}
          authBusy={authBusy}
          defaultPasswordHint={DEFAULT_PASSWORD_HINT}
          copy={copy}
          onLoginModeChange={handleLoginModeChange}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSignIn={() => void handleSignIn()}
          onShowPatientSignup={() => {
            setAuthView('signup');
            setAuthError(null);
            setAuthSuccess(null);
            setPasswordRecovery(false);
          }}
          onForgotPassword={() => void handleForgotPassword()}
          onResendConfirmation={() => void handleResendConfirmation()}
          onSetNewPassword={(newPassword, confirmPassword) => void handleSetNewPassword(newPassword, confirmPassword)}
          onCancelPasswordRecovery={() => {
            setPasswordRecovery(false);
            setAuthSuccess(null);
            setAuthError(null);
            clearAuthHashFromUrl();
          }}
          onDemoEnter={() => {
            const screen = resolveScreenForRole(role, parseAppScreenPath(location.pathname));
            setActiveScreen(screen);
            setStage('app');
            navigate(appScreenPath(screen), { replace: true });
          }}
        />
      ) : null}

      {stage === 'app' ? (
        <AppShell
          role={role}
          language={language}
          activeScreen={activeScreen}
          menuOpen={menuOpen}
          languageModalOpen={languageModalOpen}
          theme={theme}
          bottomTabs={bottomTabs}
          userId={user?.id}
          userEmail={user?.email}
          doctorProfile={doctorProfile}
          patientProfile={patientProfile}
          dbConnected={dbConnected && configured}
          copy={copy}
          onMenuToggle={() => setMenuOpen((open) => !open)}
          onMenuClose={() => setMenuOpen(false)}
          onNavigate={goToScreen}
          onLanguageModalOpen={() => setLanguageModalOpen(true)}
          onLanguageModalClose={() => setLanguageModalOpen(false)}
          onLanguageChange={setLanguage}
          onThemeToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onSignOut={session ? handleSignOut : undefined}
          onRequestProfileSetup={openProfileSetup}
        />
      ) : null}
    </main>
  );
}

export default App;
