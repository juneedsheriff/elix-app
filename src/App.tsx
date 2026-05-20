import { useEffect, useMemo, useState } from 'react';
import AppShell from './layout/AppShell';
import AuthPage, { type LoginMode } from './pages/auth/AuthPage';
import OnboardingPage from './pages/auth/OnboardingPage';
import SplashPage from './pages/auth/SplashPage';
import { getNavItems, TRANSLATIONS, type Language, type Role as AppRole } from './i18n/appTranslations';
import { getBottomTabs } from './lib/navigation/bottomTabs';
import { useSupabase } from './context/SupabaseProvider';
import { supabase } from './lib/supabase';

type Role = AppRole;
type Theme = 'light' | 'dark';
type Stage = 'splash' | 'onboarding' | 'auth' | 'app';

const DEFAULT_PASSWORD_HINT = 'Elix@123';

function App() {
  const {
    configured,
    loading: authLoading,
    session,
    user,
    doctorProfile,
    patientProfile,
    isDoctor,
    signIn,
    signUp,
    signOut
  } = useSupabase();

  const [theme, setTheme] = useState<Theme>('light');
  const [role, setRole] = useState<Role>('patient');
  const [loginMode, setLoginMode] = useState<LoginMode>('patient');
  const [stage, setStage] = useState<Stage>('splash');
  const [language, setLanguage] = useState<Language>('en');
  const [activeScreen, setActiveScreen] = useState<string>('patient-dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [patientName, setPatientName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  const copy = useMemo(() => TRANSLATIONS[language], [language]);
  const bottomTabs = useMemo(() => getBottomTabs(role, language), [role, language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    setActiveScreen(getNavItems(role, language)[0]?.id ?? 'patient-dashboard');
    setMenuOpen(false);
  }, [role, language]);

  const goToScreen = (screenId: string) => {
    setActiveScreen(screenId);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (stage !== 'splash') return;
    const timeout = window.setTimeout(() => {
      if (configured && session) {
        setStage('app');
      } else {
        setStage('onboarding');
      }
    }, 1700);
    return () => window.clearTimeout(timeout);
  }, [stage, configured, session]);

  useEffect(() => {
    if (!authLoading && session && (stage === 'auth' || stage === 'onboarding')) {
      setStage('app');
    }
  }, [authLoading, session, stage]);

  useEffect(() => {
    if (isDoctor && doctorProfile) {
      setRole('doctor');
      setActiveScreen('doctor-dashboard');
    }
  }, [isDoctor, doctorProfile]);

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
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleAuth = async (mode: 'signin' | 'signup') => {
    setAuthError(null);
    if (!email.trim() || !password) {
      setAuthError('Enter email and password.');
      return;
    }
    if (loginMode === 'doctor' && mode === 'signup') {
      setAuthError('Doctor accounts are created by the platform. Use your assigned email to sign in.');
      return;
    }
    setAuthBusy(true);
    if (mode === 'signin') {
      const { error, doctor, patient } = await signIn(email.trim(), password);
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
      if (loginMode === 'patient' && doctor) {
        setAuthError('This is a doctor account. Switch to the Doctor tab to sign in.');
        await signOut();
        return;
      }
      setRole(doctor ? 'doctor' : 'patient');
      setActiveScreen(doctor ? 'doctor-dashboard' : getNavItems('patient', language)[0]?.id ?? 'patient-dashboard');
      setStage('app');
      setAuthError(null);
      return;
    }
    const displayName =
      patientName.trim() ||
      email
        .trim()
        .split('@')[0]
        .replace(/[._-]+/g, ' ');
    const { error, patient } = await signUp(email.trim(), password, {
      full_name: displayName,
      email: email.trim()
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    if (patient) {
      setRole('patient');
      setStage('app');
      setAuthError(null);
      return;
    }
    setAuthError(
      'Account created. If email confirmation is enabled in Supabase, confirm your email then sign in with the same password.'
    );
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setAuthError('Enter your email first.');
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setAuthBusy(false);
    setAuthError(error ? error.message : 'Password reset email sent.');
  };

  const handleSignOut = async () => {
    await signOut();
    setStage('auth');
    setActiveScreen(getNavItems(role, language)[0]?.id ?? 'patient-dashboard');
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

      {stage === 'auth' ? (
        <AuthPage
          loginMode={loginMode}
          configured={configured}
          email={email}
          password={password}
          patientName={patientName}
          authError={authError}
          authBusy={authBusy}
          defaultPasswordHint={DEFAULT_PASSWORD_HINT}
          copy={copy}
          onLoginModeChange={setLoginMode}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onPatientNameChange={setPatientName}
          onSignIn={() => void handleAuth('signin')}
          onSignUp={() => void handleAuth('signup')}
          onForgotPassword={() => void handleForgotPassword()}
          onDemoEnter={() => setStage('app')}
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
        />
      ) : null}
    </main>
  );
}

export default App;
