import { useState, type FormEvent } from 'react';
import { Stethoscope } from 'lucide-react';
import { Lock, Mail } from '../../navIcons';

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

export default function AuthPage({
  loginMode,
  configured,
  passwordRecovery,
  email,
  password,
  authError,
  authSuccess,
  authBusy,
  defaultPasswordHint,
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
      <div className='mobile-shell mobile-shell--stage auth-shell'>
        <section className='auth-stage'>
          <h2>Set new password</h2>
          <p className='muted'>Enter a new password for your account.</p>

          <form
            className='auth-form'
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

            <button type='submit' className='primary-btn' disabled={authBusy || !configured}>
              {authBusy ? '…' : 'Save new password'}
            </button>
            <button type='button' className='text-btn' onClick={onCancelPasswordRecovery} disabled={authBusy}>
              Back to sign in
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className='mobile-shell mobile-shell--stage auth-shell'>
      <section className='auth-stage'>
        <div className='logo-badge'>
          <img src='/logo-small-2.png' alt='elix' />
        </div>
        <h2>{loginMode === 'doctor' ? copy.doctorSignIn : copy.signIn}</h2>
        {configured ? (
          <p className='muted db-status'>{copy.connected}</p>
        ) : (
          <p className='muted db-status warn'>Add VITE_SUPABASE_* to .env.local and restart dev server</p>
        )}
        <div className='auth-mode-tabs' role='tablist' aria-label='Login type'>
          <button
            type='button'
            role='tab'
            aria-selected={loginMode === 'patient'}
            className={loginMode === 'patient' ? 'auth-mode-tab active' : 'auth-mode-tab'}
            onClick={() => onLoginModeChange('patient')}
          >
            {copy.patientTab}
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={loginMode === 'doctor'}
            className={loginMode === 'doctor' ? 'auth-mode-tab active' : 'auth-mode-tab'}
            onClick={() => onLoginModeChange('doctor')}
          >
            <Stethoscope size={16} aria-hidden /> {copy.doctorTab}
          </button>
        </div>
        {loginMode === 'doctor' ? (
          <p className='muted doctor-login-hint'>
            Mobile doctor app. For the desktop workspace, sign in at /elixhealth/login.
          </p>
        ) : null}
        <form
          className='auth-form'
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
          <button type='submit' className='primary-btn' disabled={authBusy || !configured}>
            {authBusy ? '…' : loginMode === 'doctor' ? copy.signInAsDoctor : copy.signInAsPatient}
          </button>
          {loginMode === 'patient' ? (
            <button
              type='button'
              className='secondary-btn'
              disabled={authBusy}
              onClick={onShowPatientSignup}
            >
              {copy.createPatientAccount}
            </button>
          ) : null}
          <button
            type='button'
            className='text-btn'
            onClick={(e) => {
              e.preventDefault();
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
        </form>
        {!configured ? (
          <button type='button' className='primary-btn wide' onClick={onDemoEnter}>
            Enter Platform (demo, no database)
          </button>
        ) : null}
      </section>
    </div>
  );
}
