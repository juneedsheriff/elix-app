import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { updateStaffMember } from '../../../lib/adminAuth';
import { adminRoleLabel } from '../../../lib/staffPermissions';
import type { Admin } from '../../../types/admin';

type StaffProfileFormProps = {
  staff: Admin;
  onSaved: (staff: Admin) => void;
  readOnlyEmail?: boolean;
};

export default function StaffProfileForm({ staff, onSaved, readOnlyEmail = false }: StaffProfileFormProps) {
  const [fullName, setFullName] = useState(staff.full_name);
  const [email, setEmail] = useState(staff.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFullName(staff.full_name);
    setEmail(staff.email);
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
  }, [staff.id, staff.full_name, staff.email]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Enter your full name.');
      return;
    }
    if (!trimmedEmail) {
      setError('Enter an email address.');
      return;
    }

    if (password || confirmPassword) {
      if (password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    const { data, error: updateError } = await updateStaffMember(staff.id, {
      full_name: trimmedName,
      email: trimmedEmail,
      ...(password ? { password } : {})
    });
    setBusy(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setSuccess('Profile saved.');
    if (data?.staff) {
      onSaved({
        ...staff,
        full_name: data.staff.full_name,
        email: data.staff.email,
        updated_at: data.staff.updated_at
      });
    } else {
      onSaved({ ...staff, full_name: trimmedName, email: trimmedEmail });
    }
  };

  return (
    <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}
      {success ? (
        <p className='elixhealth-success' role='status'>
          {success}
        </p>
      ) : null}

      <p className='muted elixhealth-staff-note'>
        Role: <strong>{adminRoleLabel(staff.role)}</strong>
        {staff.clinic_name ? (
          <>
            {' '}
            · Clinic: <strong>{staff.clinic_name}</strong>
          </>
        ) : null}
      </p>

      <label className='elixhealth-field elixhealth-field--full'>
        <span>Full name</span>
        <input
          type='text'
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete='name'
          required
          disabled={busy}
        />
      </label>

      <label className='elixhealth-field elixhealth-field--full'>
        <span>Email</span>
        <input
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete='email'
          required
          disabled={busy || readOnlyEmail}
        />
      </label>

      <label className='elixhealth-field elixhealth-field--full'>
        <span>New password (optional)</span>
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete='new-password'
          disabled={busy}
        />
      </label>

      <label className='elixhealth-field elixhealth-field--full'>
        <span>Confirm new password</span>
        <input
          type='password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete='new-password'
          disabled={busy}
        />
      </label>

      <div className='elixhealth-form-actions'>
        <button type='submit' className='primary-btn' disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className='spin' aria-hidden /> Saving…
            </>
          ) : (
            'Save profile'
          )}
        </button>
      </div>
    </form>
  );
}
