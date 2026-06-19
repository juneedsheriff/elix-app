import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { createPatientForAdmin, type AdminPatientUpdateInput } from '../../../lib/admins';
import { FieldLabel } from './adminDoctorFormUi';

type AdminPatientCreateFormProps = {
  clinicId: string;
  onCreated: () => void;
  onCancel: () => void;
};

function emptyPatientInput(): AdminPatientUpdateInput {
  return {
    full_name: '',
    email: '',
    phone: null,
    date_of_birth: null,
    gender: null,
    blood_group: null,
    country: null,
    city: null,
    allergies: null,
    current_medications: null,
    insurance_provider: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    preferred_language: 'English'
  };
}

export default function AdminPatientCreateForm({ clinicId, onCreated, onCancel }: AdminPatientCreateFormProps) {
  const [form, setForm] = useState<AdminPatientUpdateInput>(() => emptyPatientInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof AdminPatientUpdateInput>(key: K, value: AdminPatientUpdateInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.full_name.trim()) {
      setError('Enter the patient’s full name.');
      return;
    }
    if (!form.email.trim()) {
      setError('Enter an email address.');
      return;
    }

    setBusy(true);
    setError(null);
    const { error: createError } = await createPatientForAdmin(form, { clinicId });
    setBusy(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    onCreated();
  };

  return (
    <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      <p className='muted elixhealth-form-intro'>
        Add a patient to your clinic workspace. Enable login later from the patient profile.
      </p>

      <fieldset disabled={busy} className='elixhealth-form-fieldset'>
        <div className='elixhealth-form-grid'>
          <label className='elixhealth-field elixhealth-field--full'>
            <FieldLabel required>Full name</FieldLabel>
            <input
              type='text'
              value={form.full_name}
              onChange={(e) => setField('full_name', e.target.value)}
              required
            />
          </label>
          <label className='elixhealth-field elixhealth-field--full'>
            <FieldLabel required>Email</FieldLabel>
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
        </div>

        <div className='elixhealth-form-actions'>
          <button type='button' className='secondary-btn' disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type='submit' className='primary-btn' disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className='spin' aria-hidden /> Creating…
              </>
            ) : (
              'Create patient'
            )}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
