import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Pencil, User } from 'lucide-react';
import SectionCard from '../ui/SectionCard';
import { useSupabase } from '../../context/SupabaseProvider';
import {
  joinPatientFullName,
  splitPatientFullName,
  updatePatientProfileForUser
} from '../../lib/patients';
import type { Patient } from '../../types/patient';

type PatientProfileEditSectionProps = {
  patientProfile: Patient | null;
  userId: string | null | undefined;
};

export default function PatientProfileEditSection({
  patientProfile,
  userId
}: PatientProfileEditSectionProps) {
  const { refreshPatientProfile } = useSupabase();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!patientProfile) return;
    const { firstName: first, lastName: last } = splitPatientFullName(patientProfile.full_name);
    setFirstName(first);
    setLastName(last);
    setPhone(patientProfile.phone ?? '');
  }, [patientProfile]);

  const resetForm = () => {
    if (!patientProfile) return;
    const { firstName: first, lastName: last } = splitPatientFullName(patientProfile.full_name);
    setFirstName(first);
    setLastName(last);
    setPhone(patientProfile.phone ?? '');
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    resetForm();
    setEditing(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) return;

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setError('Enter your first name.');
      setSuccess(null);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const payload = {
      full_name: joinPatientFullName(trimmedFirst, lastName),
      phone: phone.trim() || null
    };

    const { data, error: saveError } = await updatePatientProfileForUser(userId, payload);
    setBusy(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    await refreshPatientProfile();
    if (data) {
      const { firstName: first, lastName: last } = splitPatientFullName(data.full_name);
      setFirstName(first);
      setLastName(last);
      setPhone(data.phone ?? '');
    }
    setSuccess('Profile updated.');
    setEditing(false);
  };

  if (!userId) return null;

  const displayName = patientProfile?.full_name?.trim() || 'Your profile';
  const displayPhone = patientProfile?.phone?.trim() || 'Not set';

  return (
    <SectionCard
      title='Your profile'
      subtitle={
        patientProfile?.elix_id
          ? `Patient ID ${patientProfile.elix_id}`
          : 'Keep your contact details up to date'
      }
    >
      {!patientProfile ? (
        <p className='muted'>Sign in to load your patient profile.</p>
      ) : editing ? (
        <form className='patient-profile-edit' onSubmit={(e) => void handleSubmit(e)}>
          {error ? (
            <p className='auth-error' role='alert'>
              {error}
            </p>
          ) : null}
          <div className='patient-profile-edit__grid'>
            <label className='patient-profile-edit__field'>
              <span>First name</span>
              <input
                type='text'
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete='given-name'
                required
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field'>
              <span>Last name</span>
              <input
                type='text'
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete='family-name'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field patient-profile-edit__field--full'>
              <span>Phone number</span>
              <input
                type='tel'
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete='tel'
                placeholder='Optional'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field patient-profile-edit__field--full'>
              <span>Email</span>
              <input type='email' value={patientProfile.email} disabled readOnly />
            </label>
          </div>
          <div className='patient-profile-edit__actions'>
            <button type='submit' className='primary-btn' disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> Saving…
                </>
              ) : (
                'Save profile'
              )}
            </button>
            <button type='button' className='secondary-btn' disabled={busy} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {success ? (
            <p className='patient-profile-edit__success' role='status'>
              {success}
            </p>
          ) : null}
          <div className='patient-profile-edit__summary'>
            <div className='patient-profile-edit__avatar' aria-hidden>
              <User size={20} />
            </div>
            <div className='patient-profile-edit__details'>
              <p className='patient-profile-edit__name'>{displayName}</p>
              <p className='patient-profile-edit__meta'>{patientProfile.email}</p>
              <p className='patient-profile-edit__meta'>Phone: {displayPhone}</p>
            </div>
            <button
              type='button'
              className='secondary-btn patient-profile-edit__edit-btn'
              onClick={() => {
                setSuccess(null);
                setEditing(true);
              }}
            >
              <Pencil size={15} aria-hidden />
              Edit profile
            </button>
          </div>
        </>
      )}
    </SectionCard>
  );
}
