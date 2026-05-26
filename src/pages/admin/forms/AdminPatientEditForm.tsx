import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { updatePatientForAdmin, type AdminPatientUpdateInput } from '../../../lib/admins';
import type { Patient } from '../../../types/patient';
import AdminAccountAccessPanel from './AdminAccountAccessPanel';

type AdminPatientEditFormProps = {
  patient: Patient;
  onSaved: (patient: Patient) => void;
  onAuthChanged?: () => void;
};

function toFormState(patient: Patient): AdminPatientUpdateInput {
  return {
    full_name: patient.full_name,
    email: patient.email,
    phone: patient.phone,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    blood_group: patient.blood_group,
    country: patient.country,
    city: patient.city,
    allergies: patient.allergies,
    current_medications: patient.current_medications,
    insurance_provider: patient.insurance_provider,
    emergency_contact_name: patient.emergency_contact_name,
    emergency_contact_phone: patient.emergency_contact_phone,
    preferred_language: patient.preferred_language
  };
}

export default function AdminPatientEditForm({ patient, onSaved, onAuthChanged }: AdminPatientEditFormProps) {
  const [form, setForm] = useState<AdminPatientUpdateInput>(() => toFormState(patient));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(toFormState(patient));
    setError(null);
  }, [patient]);

  const setField = <K extends keyof AdminPatientUpdateInput>(key: K, value: AdminPatientUpdateInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await updatePatientForAdmin(patient.id, form);
    setBusy(false);

    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save patient profile.');
      return;
    }

    onSaved(data);
  };

  return (
    <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      <p className='elixhealth-readonly-id'>
        Patient ID: <code>{patient.elix_id}</code>
      </p>

      <div className='elixhealth-form-grid'>
        <label className='elixhealth-field'>
          <span>Full name</span>
          <input
            type='text'
            value={form.full_name}
            onChange={(e) => setField('full_name', e.target.value)}
            required
          />
        </label>
        <label className='elixhealth-field'>
          <span>Email</span>
          <input
            type='email'
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            required
          />
        </label>
        <label className='elixhealth-field'>
          <span>Phone</span>
          <input
            type='tel'
            value={form.phone ?? ''}
            onChange={(e) => setField('phone', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Date of birth</span>
          <input
            type='date'
            value={form.date_of_birth ?? ''}
            onChange={(e) => setField('date_of_birth', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Gender</span>
          <input
            type='text'
            value={form.gender ?? ''}
            onChange={(e) => setField('gender', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Blood group</span>
          <input
            type='text'
            value={form.blood_group ?? ''}
            onChange={(e) => setField('blood_group', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Country</span>
          <input
            type='text'
            value={form.country ?? ''}
            onChange={(e) => setField('country', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>City</span>
          <input
            type='text'
            value={form.city ?? ''}
            onChange={(e) => setField('city', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Preferred language</span>
          <input
            type='text'
            value={form.preferred_language}
            onChange={(e) => setField('preferred_language', e.target.value)}
            required
          />
        </label>
        <label className='elixhealth-field'>
          <span>Insurance provider</span>
          <input
            type='text'
            value={form.insurance_provider ?? ''}
            onChange={(e) => setField('insurance_provider', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Emergency contact name</span>
          <input
            type='text'
            value={form.emergency_contact_name ?? ''}
            onChange={(e) => setField('emergency_contact_name', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Emergency contact phone</span>
          <input
            type='tel'
            value={form.emergency_contact_phone ?? ''}
            onChange={(e) => setField('emergency_contact_phone', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field elixhealth-field--full'>
          <span>Allergies</span>
          <textarea
            rows={2}
            value={form.allergies ?? ''}
            onChange={(e) => setField('allergies', e.target.value || null)}
          />
        </label>
        <label className='elixhealth-field elixhealth-field--full'>
          <span>Current medications</span>
          <textarea
            rows={2}
            value={form.current_medications ?? ''}
            onChange={(e) => setField('current_medications', e.target.value || null)}
          />
        </label>
      </div>

      <AdminAccountAccessPanel
        role='patient'
        profileId={patient.id}
        profileEmail={patient.email}
        authUserId={patient.auth_user_id}
        loginDisabled={patient.login_disabled}
        onAuthChanged={onAuthChanged}
      />

      <div className='elixhealth-form-actions'>
        <button type='submit' className='primary-btn' disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className='spin' aria-hidden /> Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>
    </form>
  );
}
