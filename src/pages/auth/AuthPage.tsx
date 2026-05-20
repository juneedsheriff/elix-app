import { type FormEvent } from 'react';
import { Stethoscope } from 'lucide-react';
import { Lock, Mail } from '../../navIcons';

export type LoginMode = 'patient' | 'doctor';

type AuthPageProps = {
  loginMode: LoginMode;
  configured: boolean;
  email: string;
  password: string;
  patientName: string;
  authError: string | null;
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
  onPatientNameChange: (value: string) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onForgotPassword: () => void;
  onDemoEnter: () => void;
};

export default function AuthPage({
  loginMode,
  configured,
  email,
  password,
  patientName,
  authError,
  authBusy,
  defaultPasswordHint,
  copy,
  onLoginModeChange,
  onEmailChange,
  onPasswordChange,
  onPatientNameChange,
  onSignIn,
  onSignUp,
  onForgotPassword,
  onDemoEnter
}: AuthPageProps) {
  return (
    <div className='mobile-shell mobile-shell--stage'>
      <section className='auth-stage'>
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
            Use your <strong>@elixapp.health</strong> email. Default password: <strong>{defaultPasswordHint}</strong>
          </p>
        ) : (
          <p className='muted doctor-login-hint'>
            Sign in with your <strong>email</strong> and <strong>password</strong>. Demo:{' '}
            <strong>alex.morgan@elixapp.health</strong> / <strong>{defaultPasswordHint}</strong>
          </p>
        )}
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
          <button type='submit' className='primary-btn' disabled={authBusy || !configured}>
            {authBusy ? '…' : loginMode === 'doctor' ? copy.signInAsDoctor : copy.signInAsPatient}
          </button>
          {loginMode === 'patient' ? (
            <>
              <label className='input-field'>
                <span className='sr-only'>{copy.fullNamePlaceholder}</span>
                <input
                  type='text'
                  placeholder={copy.fullNamePlaceholder}
                  aria-label='Full name'
                  value={patientName}
                  onChange={(event) => onPatientNameChange(event.target.value)}
                  autoComplete='name'
                />
              </label>
              <button type='button' className='secondary-btn' disabled={authBusy || !configured} onClick={onSignUp}>
                {authBusy ? '…' : copy.createPatientAccount}
              </button>
            </>
          ) : null}
          <button type='button' className='text-btn' onClick={onForgotPassword} disabled={authBusy}>
            Forgot password?
          </button>
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
