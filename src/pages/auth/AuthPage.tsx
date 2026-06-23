import { useState, type FormEvent, type ReactNode } from 'react';
import { Stethoscope } from 'lucide-react';
import AuthInstallAppPrompt from '../../components/auth/AuthInstallAppPrompt';
import ElixLogo from '../../components/ui/ElixLogo';
import { Lock, Mail } from '../../navIcons';
import './auth-page.css';

export type LoginMode = 'patient' | 'doctor';

type AuthPageProps = {
  loginMode: LoginMode;
  configured: boolean;
  passwordRecovery: boolean;
  email: string;
  password: string;
  authError: string | null;
  authSuccess: string | null;
  authBusy: boolean;
  defaultPasswordHint: string;
  copy: {
    doctorSignIn: string;
    signIn: string;
    connected: string;
    patientTab: string;
    doctorTab: string;
    signInAsDoctor: string;
    signInAsPatient: string;
    createPatientAccount: string;
    fullNamePlaceholder: string;
  };
  onLoginModeChange: (mode: LoginMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignIn: () => void;
  onShowPatientSignup: () => void;
  onForgotPassword: () => void;
  onResendConfirmation: () => void;
  onSetNewPassword: (newPassword: string, confirmPassword: string) => void;
  onCancelPasswordRecovery: () => void;
  onDemoEnter: () => void;
};

function AuthPageLogo() {
  return (
    <div className='auth-page__logo-wrap'>
      <ElixLogo className='auth-page__logo' width={160} height={88} />
    </div>
  );
}

function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className='auth-page'>
      <section className='auth-page__card'>{children}</section>
    </div>
  );
}

export default function AuthPage({
  loginMode,
  configured,
  passwordRecovery,
  email,
  password,
  authError,
  authSuccess,
  authBusy,
  copy,
  onLoginModeChange,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onShowPatientSignup,
  onForgotPassword,
  onResendConfirmation,
  onSetNewPassword,
  onCancelPasswordRecovery,
  onDemoEnter
}: AuthPageProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const showResendConfirmation =
    Boolean(authError) &&
    /expired|confirm|verification|invalid.+link/i.test(authError ?? '');

  if (passwordRecovery) {
    return (
      <AuthPageShell>
        <AuthPageLogo />
        <h1 className='auth-page__title'>Set new password</h1>
        <p className='auth-page__status'>Enter a new password for your account.</p>

        <AuthInstallAppPrompt />

        <form
          className='auth-page__form'
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSetNewPassword(newPassword, confirmPassword);
          }}
        >
          <label className='input-field'>
            <Lock size={18} aria-hidden />
            <input
              type='password'
              placeholder='New password'
              aria-label='New password'
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete='new-password'
              minLength={8}
              required
            />
          </label>
          <label className='input-field'>
            <Lock size={18} aria-hidden />
            <input
              type='password'
              placeholder='Confirm new password'
              aria-label='Confirm new password'
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete='new-password'
              minLength={8}
              required
            />
          </label>

          {authError ? (
            <p className='auth-error' role='alert'>
              {authError}
            </p>
          ) : null}
          {authSuccess ? (
            <p className='auth-success' role='status'>
              {authSuccess}
            </p>
          ) : null}

          <button type='submit' className='primary-btn auth-page__submit' disabled={authBusy || !configured}>
            {authBusy ? '…' : 'Save new password'}
          </button>
          <div className='auth-page__links'>
            <button type='button' className='text-btn' onClick={onCancelPasswordRecovery} disabled={authBusy}>
              Back to sign in
            </button>
          </div>
        </form>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <AuthPageLogo />
      <h1 className='auth-page__title'>{loginMode === 'doctor' ? copy.doctorSignIn : copy.signIn}</h1>
      {configured ? (
        <p className='auth-page__status'>{copy.connected}</p>
      ) : (
        <p className='auth-page__status auth-page__status--warn'>
          Add VITE_SUPABASE_* to .env.local and restart dev server
        </p>
      )}

      <AuthInstallAppPrompt />

      <div className='auth-page__tabs' role='tablist' aria-label='Login type'>
        <button
          type='button'
          role='tab'
          aria-selected={loginMode === 'patient'}
          className={`auth-page__tab${loginMode === 'patient' ? ' auth-page__tab--active' : ''}`}
          onClick={() => onLoginModeChange('patient')}
        >
          {copy.patientTab}
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={loginMode === 'doctor'}
          className={`auth-page__tab${loginMode === 'doctor' ? ' auth-page__tab--active' : ''}`}
          onClick={() => onLoginModeChange('doctor')}
        >
          <Stethoscope size={16} aria-hidden /> {copy.doctorTab}
        </button>
      </div>

      <div className='auth-page__hint-slot' aria-live='polite'>
        {loginMode === 'doctor' ? (
          <p className='auth-page__hint'></p>
        ) : (
          <span className='auth-page__hint-placeholder' aria-hidden />
        )}
      </div>

      <form
        className='auth-page__form'
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSignIn();
        }}
      >
        <label className='input-field'>
          <Mail size={18} aria-hidden />
          <input
            type='email'
            placeholder='Email address'
            aria-label='Email address'
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            autoComplete='email'
          />
        </label>
        <label className='input-field'>
          <Lock size={18} aria-hidden />
          <input
            type='password'
            placeholder='Password'
            aria-label='Password'
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete='current-password'
          />
        </label>

        {authError ? (
          <p className='auth-error' role='alert'>
            {authError}
          </p>
        ) : null}
        {authSuccess ? (
          <p className='auth-success' role='status'>
            {authSuccess}
          </p>
        ) : null}

        <button type='submit' className='primary-btn auth-page__submit' disabled={authBusy || !configured}>
          {authBusy ? '…' : loginMode === 'doctor' ? copy.signInAsDoctor : copy.signInAsPatient}
        </button>

        <button
          type='button'
          className={`secondary-btn auth-page__secondary${loginMode === 'patient' ? '' : ' auth-page__secondary--hidden'}`}
          disabled={authBusy || loginMode !== 'patient'}
          aria-hidden={loginMode !== 'patient'}
          tabIndex={loginMode === 'patient' ? 0 : -1}
          onClick={onShowPatientSignup}
        >
          {copy.createPatientAccount}
        </button>
      </form>

      <div className='auth-page__links'>
        <button
          type='button'
          className='text-btn'
          onClick={(event) => {
            event.preventDefault();
            onForgotPassword();
          }}
          disabled={authBusy || !configured}
        >
          Forgot password?
        </button>
        {loginMode === 'patient' && showResendConfirmation ? (
          <button type='button' className='text-btn' onClick={onResendConfirmation} disabled={authBusy || !configured}>
            Resend confirmation email
          </button>
        ) : null}
      </div>

      {!configured ? (
        <button type='button' className='primary-btn auth-page__demo' onClick={onDemoEnter}>
          Enter Platform (demo, no database)
        </button>
      ) : null}
    </AuthPageShell>
  );
}
