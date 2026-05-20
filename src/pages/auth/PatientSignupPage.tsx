import { useState, type FormEvent } from 'react';
import { Lock, Mail, User } from '../../navIcons';

export type PatientSignupPayload = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  country: string;
};

type PatientSignupPageProps = {
  configured: boolean;
  authBusy: boolean;
  authError: string | null;
  authSuccess: string | null;
  copy: {
    createPatientAccount: string;
    fullNamePlaceholder: string;
    connected: string;
  };
  onSubmit: (payload: PatientSignupPayload) => void;
  onBack: () => void;
};

export default function PatientSignupPage({
  configured,
  authBusy,
  authError,
  authSuccess,
  copy,
  onSubmit,
  onBack
}: PatientSignupPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setLocalError('Enter your full name.');
      return;
    }
    if (!trimmedEmail) {
      setLocalError('Enter your email address.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    onSubmit({
      fullName: trimmedName,
      email: trimmedEmail,
      password,
      phone: phone.trim(),
      country: country.trim()
    });
  };

  const displayError = localError ?? authError;

  return (
    <div className='mobile-shell mobile-shell--stage'>
      <section className='auth-stage'>
        <button type='button' className='text-btn auth-back-link' onClick={onBack} disabled={authBusy}>
          ← Back to sign in
        </button>

        <h2>{copy.createPatientAccount}</h2>
        <p className='muted'>
          Register as a patient. Your profile is saved to the <strong>patients</strong> table when you submit this form.
        </p>
        {configured ? (
          <p className='muted db-status'>{copy.connected}</p>
        ) : (
          <p className='muted db-status warn'>Add VITE_SUPABASE_* to .env.local and restart dev server</p>
        )}

        <form className='auth-form' onSubmit={handleSubmit}>
          <label className='input-field'>
            <User size={18} aria-hidden />
            <input
              type='text'
              placeholder={copy.fullNamePlaceholder}
              aria-label='Full name'
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete='name'
              required
            />
          </label>

          <label className='input-field'>
            <Mail size={18} aria-hidden />
            <input
              type='email'
              placeholder='Email address'
              aria-label='Email address'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete='email'
              required
            />
          </label>

          <label className='input-field'>
            <input
              type='tel'
              placeholder='Phone (optional)'
              aria-label='Phone'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete='tel'
            />
          </label>

          <label className='input-field'>
            <input
              type='text'
              placeholder='Country (optional)'
              aria-label='Country'
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              autoComplete='country-name'
            />
          </label>

          <label className='input-field'>
            <Lock size={18} aria-hidden />
            <input
              type='password'
              placeholder='Password (min. 8 characters)'
              aria-label='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete='new-password'
              minLength={8}
              required
            />
          </label>

          <label className='input-field'>
            <Lock size={18} aria-hidden />
            <input
              type='password'
              placeholder='Confirm password'
              aria-label='Confirm password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete='new-password'
              minLength={8}
              required
            />
          </label>

          {displayError ? (
            <p className='auth-error' role='alert'>
              {displayError}
            </p>
          ) : null}
          {authSuccess ? (
            <p className='auth-success' role='status'>
              {authSuccess}
            </p>
          ) : null}

          <button type='submit' className='primary-btn' disabled={authBusy || !configured}>
            {authBusy ? '…' : copy.createPatientAccount}
          </button>
        </form>
      </section>
    </div>
  );
}
