import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  fetchAccountAuthStatus,
  loginStatusLabel,
  manageAccountAuth,
  type AccountAuthStatus,
  type AccountRole
} from '../../../lib/adminAuth';

type AdminAccountAccessPanelProps = {
  role: AccountRole;
  profileId: string;
  profileEmail: string;
  authUserId?: string | null;
  loginDisabled?: boolean;
  onAuthChanged?: () => void;
};

export default function AdminAccountAccessPanel({
  role,
  profileId,
  profileEmail,
  authUserId,
  loginDisabled,
  onAuthChanged
}: AdminAccountAccessPanelProps) {
  const [status, setStatus] = useState<AccountAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await fetchAccountAuthStatus(role, profileId);
      if (fetchError) {
        setStatus(null);
        setError(fetchError);
      } else {
        setStatus(data);
      }
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Could not load login status.');
    } finally {
      setLoading(false);
    }
  }, [role, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loginEnabled = status?.loginEnabled ?? (Boolean(authUserId) && !loginDisabled);
  const hasAuth = status?.hasAuth ?? Boolean(authUserId);

  const runAction = async (action: 'enable' | 'disable' | 'set_password') => {
    setBusy(true);
    setError(null);
    setMessage(null);

    if ((action === 'enable' || action === 'set_password') && password.length < 6) {
      setError('Password must be at least 6 characters.');
      setBusy(false);
      return;
    }

    if ((action === 'enable' || action === 'set_password') && password !== confirmPassword) {
      setError('Passwords do not match.');
      setBusy(false);
      return;
    }

    try {
      const { data, error: actionError } = await manageAccountAuth(
        role,
        profileId,
        action,
        action === 'disable' ? undefined : password
      );

      if (actionError || !data?.status) {
        setError(actionError ?? 'Action failed.');
        return;
      }

      setStatus(data.status);
      setPassword('');
      setConfirmPassword('');
      setMessage(
        action === 'enable'
          ? 'Login enabled.'
          : action === 'disable'
            ? 'Login disabled.'
            : 'Password updated.'
      );
      onAuthChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className='elixhealth-auth-panel'>
      <h3 className='elixhealth-form-section-title'>Login access</h3>
      <p className='muted'>
        Manage Supabase Auth for <strong>{profileEmail}</strong>. Disabled users cannot sign in until re-enabled.
      </p>

      {loading ? (
        <p className='elixhealth-status'>
          <Loader2 size={16} className='spin' aria-hidden /> Checking login status…
        </p>
      ) : null}

      {error ? (
        <p className='auth-error' role='alert'>
          {error}
          <button type='button' className='elixhealth-retry-link' onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}

      {message ? (
        <p className='elixhealth-success' role='status'>
          {message}
        </p>
      ) : null}

      <div className='elixhealth-auth-status-row'>
        <span>Status</span>
        <strong className={loginEnabled ? 'elixhealth-badge elixhealth-badge--ok' : 'elixhealth-badge'}>
          {loading ? '…' : loginStatusLabel(status, authUserId, loginDisabled)}
        </strong>
      </div>

      <div className='elixhealth-form-grid'>
        <label className='elixhealth-field elixhealth-field--full'>
          <span>New password</span>
          <input
            type='password'
            autoComplete='new-password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Min. 6 characters'
            disabled={busy || loading}
          />
        </label>
        <label className='elixhealth-field elixhealth-field--full'>
          <span>Confirm password</span>
          <input
            type='password'
            autoComplete='new-password'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy || loading}
          />
        </label>
      </div>

      <div className='elixhealth-auth-actions'>
        {!loginEnabled ? (
          <button
            type='button'
            className='primary-btn'
            disabled={busy || loading || !password}
            onClick={() => void runAction('enable')}
          >
            {busy ? <Loader2 size={16} className='spin' aria-hidden /> : null}
            Enable login
          </button>
        ) : (
          <button
            type='button'
            className='secondary-btn'
            disabled={busy || loading}
            onClick={() => void runAction('disable')}
          >
            Disable login
          </button>
        )}
        {hasAuth ? (
          <button
            type='button'
            className='secondary-btn'
            disabled={busy || loading || !password}
            onClick={() => void runAction('set_password')}
          >
            Change password
          </button>
        ) : null}
      </div>
    </section>
  );
}
