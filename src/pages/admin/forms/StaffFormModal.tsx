import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { createStaffMember, updateStaffMember } from '../../../lib/adminAuth';
import { fetchPseClinicsForAdmin } from '../../../lib/clinicDoctorRequests';
import { adminRoleLabel } from '../../../lib/staffPermissions';
import type { Admin, AdminRole } from '../../../types/admin';

type StaffFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  staff?: Admin | null;
  onClose: () => void;
  onSaved: () => void;
};

type ClinicOption = { id: string; name: string };

const NEW_CLINIC_VALUE = '__new_clinic__';

export default function StaffFormModal({ open, mode, staff, onClose, onSaved }: StaffFormModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('patient_service_executive');
  const [clinicSelection, setClinicSelection] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicOptions, setClinicOptions] = useState<ClinicOption[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === 'edit';
  const isClinicRole = isEdit ? staff?.role === 'patient_service_executive_clinic' : role === 'patient_service_executive_clinic';
  const usesNewClinic = clinicSelection === NEW_CLINIC_VALUE;

  useEffect(() => {
    if (!open) return;
    setFullName(staff?.full_name ?? '');
    setEmail(staff?.email ?? '');
    setRole(staff?.role ?? 'patient_service_executive');
    setClinicSelection(staff?.clinic_id ?? NEW_CLINIC_VALUE);
    setClinicName(staff?.clinic_name ?? '');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setBusy(false);
  }, [open, staff]);

  useEffect(() => {
    if (!open || !isClinicRole) return;

    let cancelled = false;
    setClinicsLoading(true);
    void fetchPseClinicsForAdmin().then(({ data }) => {
      if (cancelled) return;
      setClinicOptions(data ?? []);
      setClinicsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, isClinicRole]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  const resolveClinicPayload = () => {
    if (!isClinicRole) return {};

    if (usesNewClinic) {
      const trimmed = clinicName.trim();
      if (!trimmed) {
        return { error: 'Enter a clinic name for this workspace.' };
      }
      return { clinic_name: trimmed };
    }

    if (!clinicSelection) {
      return { error: 'Select a clinic workspace.' };
    }

    return { clinic_id: clinicSelection };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('Enter the staff member’s full name.');
      return;
    }
    if (!trimmedEmail) {
      setError('Enter an email address.');
      return;
    }

    if (!isEdit) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else if (password || confirmPassword) {
      if (password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    const clinicPayload = resolveClinicPayload();
    if ('error' in clinicPayload && clinicPayload.error) {
      setError(clinicPayload.error);
      return;
    }

    setBusy(true);

    if (isEdit) {
      if (!staff) {
        setBusy(false);
        setError('Staff member not found.');
        return;
      }

      const clinicChanged =
        isClinicRole && (usesNewClinic || clinicSelection !== (staff.clinic_id ?? ''));

      const { error: updateError } = await updateStaffMember(staff.id, {
        full_name: trimmedName,
        email: trimmedEmail,
        ...(password ? { password } : {}),
        ...(isClinicRole && clinicChanged ? clinicPayload : {})
      });
      setBusy(false);

      if (updateError) {
        setError(updateError);
        return;
      }
    } else {
      const { error: createError } = await createStaffMember({
        full_name: trimmedName,
        email: trimmedEmail,
        role,
        password,
        ...(isClinicRole ? clinicPayload : {})
      });
      setBusy(false);

      if (createError) {
        setError(createError);
        return;
      }
    }

    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <div className='elixhealth-modal-root' role='presentation'>
      <button
        type='button'
        className='elixhealth-modal-backdrop'
        onClick={() => !busy && onClose()}
        aria-label='Close'
        disabled={busy}
      />
      <div
        className='elixhealth-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='staff-form-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='elixhealth-modal-head'>
          <div>
            <h2 id='staff-form-title'>{isEdit ? 'Edit staff member' : 'Add staff member'}</h2>
            <p className='muted'>
              {isEdit
                ? 'Update profile details, clinic workspace, or password.'
                : 'Creates a login and staff profile for the ElixClinix console.'}
            </p>
          </div>
          <button type='button' className='icon-btn elixhealth-modal-close' onClick={onClose} disabled={busy} aria-label='Close'>
            <X size={20} aria-hidden />
          </button>
        </div>

        <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
          <div className='elixhealth-modal-body'>
            {error ? (
              <p className='auth-error' role='alert'>
                {error}
              </p>
            ) : null}

            {!isEdit ? (
              <label className='elixhealth-field elixhealth-field--full'>
                <span>Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)} disabled={busy}>
                  <option value='patient_service_executive'>Patient Service Executive</option>
                  <option value='patient_service_executive_clinic'>Patient Service Executive (clinic)</option>
                  <option value='administrator'>Administrator</option>
                </select>
              </label>
            ) : null}

            {isClinicRole ? (
              <>
                <label className='elixhealth-field elixhealth-field--full'>
                  <span>Clinic workspace</span>
                  <select
                    value={clinicSelection}
                    onChange={(e) => setClinicSelection(e.target.value)}
                    disabled={busy || clinicsLoading}
                  >
                    {clinicOptions.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </option>
                    ))}
                    {/* <option value={NEW_CLINIC_VALUE}>Create new clinic workspace…</option> */}
                  </select>
                </label>
                {usesNewClinic ? (
                  <label className='elixhealth-field elixhealth-field--full'>
                    <span>New clinic name</span>
                    <input
                      type='text'
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder='e.g. City Care Clinic'
                      required
                      disabled={busy}
                    />
                  </label>
                ) : null}
                <p className='muted elixhealth-staff-note'>
                  Changing the clinic moves this executive to another isolated workspace. Existing patients,
                  doctors, and requests stay with the previous clinic.
                </p>
              </>
            ) : null}

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
                autoComplete='off'
                required
                disabled={busy}
              />
            </label>

            <label className='elixhealth-field elixhealth-field--full'>
              <span>{isEdit ? 'New password (optional)' : 'Password'}</span>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete='new-password'
                minLength={isEdit ? undefined : 6}
                required={!isEdit}
                disabled={busy}
              />
            </label>

            <label className='elixhealth-field elixhealth-field--full'>
              <span>{isEdit ? 'Confirm new password' : 'Confirm password'}</span>
              <input
                type='password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete='new-password'
                minLength={isEdit ? undefined : 6}
                required={!isEdit}
                disabled={busy}
              />
            </label>
          </div>

          <div className='elixhealth-modal-footer'>
            <button type='button' className='text-btn' onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type='submit' className='primary-btn' disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> {isEdit ? 'Saving…' : 'Creating…'}
                </>
              ) : isEdit ? (
                'Save changes'
              ) : (
                `Add ${adminRoleLabel(role)}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
