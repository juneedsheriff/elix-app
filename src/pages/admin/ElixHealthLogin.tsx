import { useState, type FormEvent } from 'react';
import { Lock, Mail, Shield } from 'lucide-react';

type ElixHealthLoginProps = {
  configured: boolean;
  busy: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => void;
};

export default function ElixHealthLogin({ configured, busy, error, onSignIn }: ElixHealthLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className='elixhealth-shell'>
      <section className='elixhealth-login-card'>
        <div className='elixhealth-brand'>
          <Shield size={32} aria-hidden />
          <div>
            <p className='elixhealth-eyebrow'>Elix Health</p>
            <h1>Desktop sign in</h1>
          </div>
        </div>
        <p className='muted'>Staff and doctors sign in here for the desktop workspace.</p>

        {!configured ? (
          <p className='auth-error' role='alert'>
            Supabase is not configured. Add VITE_SUPABASE_* to .env.local.
          </p>
        ) : null}

        <form
          className='auth-form'
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            onSignIn(email.trim(), password);
          }}
        >
          <label className='auth-field'>
            <Mail size={18} aria-hidden />
            <input
              type='email'
              autoComplete='email'
              placeholder='Work email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy || !configured}
            />
          </label>
          <label className='auth-field'>
            <Lock size={18} aria-hidden />
            <input
              type='password'
              autoComplete='current-password'
              placeholder='Password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy || !configured}
            />
          </label>
          {error ? (
            <p className='auth-error' role='alert'>
              {error}
            </p>
          ) : null}
          <button type='submit' className='primary-btn elixhealth-submit' disabled={busy || !configured}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}
