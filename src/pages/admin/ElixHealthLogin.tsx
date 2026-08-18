import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import ElixLogo from '../../components/ui/ElixLogo';

type ElixHealthLoginProps = {
  configured: boolean;
  busy: boolean;
  error: string | null;
  onSignIn: (email: string, password: string) => void;
};

export default function ElixHealthLogin({ configured, busy, error, onSignIn }: ElixHealthLoginProps) {
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const errorId = `${formId}-error`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className='elixhealth-login'>
      <div className='elixhealth-login__bg' aria-hidden />

      <main className='elixhealth-login__main'>
        <section className='elixhealth-login__card' aria-labelledby={`${formId}-title`}>
          <header className='elixhealth-login__header'>
            <ElixLogo className='elixhealth-login__logo' width={168} height={56} />
            <p className='elixhealth-login__badge'>Clinic workspace</p>
            <h1 id={`${formId}-title`} className='elixhealth-login__headline'>
              Welcome back
            </h1>
            <p className='elixhealth-login__lead'>
              Sign in with your work email to open patient requests, consultations, and clinic tools.
            </p>
          </header>

          {!configured ? (
            <p className='auth-error' role='alert'>
              ElixClinix is not configured. Add VITE_SUPABASE_* to .env.local.
            </p>
          ) : null}

          <form
            className='elixhealth-login__form'
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              onSignIn(email.trim(), password);
            }}
          >
            <label className='elixhealth-login__field' htmlFor={emailId}>
              <span>Work email</span>
              <span className='elixhealth-login__control'>
                <Mail size={18} aria-hidden />
                <input
                  id={emailId}
                  type='email'
                  autoComplete='email'
                  autoFocus
                  placeholder='you@clinic.com'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={busy || !configured}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
              </span>
            </label>

            <label className='elixhealth-login__field' htmlFor={passwordId}>
              <span>Password</span>
              <span className='elixhealth-login__control'>
                <Lock size={18} aria-hidden />
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete='current-password'
                  placeholder='Enter your password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy || !configured}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
                <button
                  type='button'
                  className='elixhealth-login__reveal'
                  onClick={() => setShowPassword((open) => !open)}
                  disabled={busy || !configured}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </span>
            </label>

            {error ? (
              <p id={errorId} className='auth-error' role='alert'>
                {error}
              </p>
            ) : null}

            <button
              type='submit'
              className='primary-btn elixhealth-login__submit'
              disabled={busy || !configured}
            >
              {busy ? <Loader2 size={18} className='spin' aria-hidden /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <footer className='elixhealth-login__footer'>
         
            <p className='elixhealth-login__secure'>
              <ShieldCheck size={15} aria-hidden />
              Authorized clinic access only
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}
