import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { createPatientForAdmin, type AdminPatientUpdateInput } from '../../../lib/admins';
import { provisionPatientLogin } from '../../../lib/adminAuth';
import {
  CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS,
  CLINIC_PSE_PATIENT_GENDER_OPTIONS
} from '../../../lib/patientProfileOptions';
import { FieldLabel } from './adminDoctorFormUi';

type AdminPatientCreateFormProps = {
  clinicId: string;
  onCreated: (result?: { warning?: string }) => void;
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
    if (!form.gender?.trim()) {
      setError('Select gender.');
      return;
    }
    if (!form.blood_group?.trim()) {
      setError('Select blood group.');
      return;
    }

    setBusy(true);
    setError(null);
    const { data: createdPatient, error: createError } = await createPatientForAdmin(form, { clinicId });
    setBusy(false);

    if (createError) {
      setError(createError.message);
      return;
    }

    if (!createdPatient?.id) {
      setError('Patient was created, but login setup could not start. Open the patient profile to enable login.');
      return;
    }

    setBusy(true);
    const { data: provisionData, error: provisionError } = await provisionPatientLogin(createdPatient.id);
    setBusy(false);

    if (provisionError) {
      onCreated({
        warning:
          `Patient created, but auto login setup failed: ${provisionError}. ` +
          'Open the patient profile to enable login manually.'
      });
      return;
    }

    onCreated({
      warning: provisionData?.emailSent
        ? undefined
        : (provisionData?.warning ??
          'Patient login was enabled, but the welcome email could not be sent. Share a temporary password by resetting it from the patient profile.')
    });
  };

  return (
    <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      <p className='muted elixhealth-form-intro'>
        Add a patient to your clinic workspace. Login is enabled automatically and a temporary password is emailed.
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
            <FieldLabel required>Gender</FieldLabel>
            <select
              value={form.gender ?? ''}
              onChange={(e) => setField('gender', e.target.value || null)}
              required
            >
              <option value='' disabled>
                Select gender
              </option>
              {CLINIC_PSE_PATIENT_GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className='elixhealth-field'>
            <FieldLabel required>Blood group</FieldLabel>
            <select
              value={form.blood_group ?? ''}
              onChange={(e) => setField('blood_group', e.target.value || null)}
              required
            >
              <option value='' disabled>
                Select blood group
              </option>
              {CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
