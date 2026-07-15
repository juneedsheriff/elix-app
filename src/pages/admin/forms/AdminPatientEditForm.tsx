import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { updatePatientForAdmin, type AdminPatientUpdateInput } from '../../../lib/admins';
import {
  CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS,
  CLINIC_PSE_PATIENT_GENDER_OPTIONS
} from '../../../lib/patientProfileOptions';
import type { Patient } from '../../../types/patient';
import AdminAccountAccessPanel from './AdminAccountAccessPanel';
import { FieldLabel } from './adminDoctorFormUi';

type AdminPatientEditFormProps = {
  patient: Patient;
  onSaved: (patient: Patient) => void;
  onAuthChanged?: () => void;
  readOnly?: boolean;
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

export default function AdminPatientEditForm({ patient, onSaved, onAuthChanged, readOnly = false }: AdminPatientEditFormProps) {
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
    const { data, error: saveError } = await updatePatientForAdmin(patient.id, form);
    setBusy(false);

    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save patient profile.');
      return;
    }

    onSaved(data);
  };

  const genderValue = form.gender?.trim() ?? '';
  const bloodGroupValue = form.blood_group?.trim() ?? '';
  const genderOptions = (
    CLINIC_PSE_PATIENT_GENDER_OPTIONS as readonly string[]
  ).includes(genderValue)
    ? [...CLINIC_PSE_PATIENT_GENDER_OPTIONS]
    : genderValue
      ? [genderValue, ...CLINIC_PSE_PATIENT_GENDER_OPTIONS]
      : [...CLINIC_PSE_PATIENT_GENDER_OPTIONS];
  const bloodGroupOptions = (
    CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS as readonly string[]
  ).includes(bloodGroupValue)
    ? [...CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS]
    : bloodGroupValue
      ? [bloodGroupValue, ...CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS]
      : [...CLINIC_PSE_PATIENT_BLOOD_GROUP_OPTIONS];

  return (
    <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
      <fieldset disabled={readOnly || busy} className='elixhealth-form-fieldset'>
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
          <FieldLabel required>Full name</FieldLabel>
          <input
            type='text'
            value={form.full_name}
            onChange={(e) => setField('full_name', e.target.value)}
            required
          />
        </label>
        <label className='elixhealth-field'>
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
          <span>Date of birth</span>
          <input
            type='date'
            value={form.date_of_birth ?? ''}
            onChange={(e) => setField('date_of_birth', e.target.value || null)}
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
            {genderOptions.map((option) => (
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
            {bloodGroupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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

      {!readOnly ? (
        <AdminAccountAccessPanel
          role='patient'
          profileId={patient.id}
          profileEmail={patient.email}
          authUserId={patient.auth_user_id}
          loginDisabled={patient.login_disabled}
          onAuthChanged={onAuthChanged}
        />
      ) : null}

      {!readOnly ? (
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
      ) : null}
      </fieldset>
    </form>
  );
}
