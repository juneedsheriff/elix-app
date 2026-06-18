import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Pencil, User } from 'lucide-react';
import SectionCard from '../ui/SectionCard';
import { useSupabase } from '../../context/SupabaseProvider';
import {
  formatPreferredLanguages,
  parsePreferredLanguages,
  PATIENT_BLOOD_GROUP_OPTIONS,
  PATIENT_GENDER_OPTIONS,
  serializePreferredLanguages
} from '../../lib/patientProfileOptions';
import {
  joinPatientFullName,
  splitPatientFullName,
  updatePatientProfileForUser
} from '../../lib/patients';
import type { Patient } from '../../types/patient';
import PatientBirthDatePicker from './PatientBirthDatePicker';
import PreferredLanguageMultiSelect from './PreferredLanguageMultiSelect';

type PatientProfileEditSectionProps = {
  patientProfile: Patient | null;
  userId: string | null | undefined;
};

type ProfileFormState = {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  country: string;
  city: string;
  address: string;
  heightCm: string;
  weightKg: string;
  allergies: string;
  currentMedications: string;
  insuranceProvider: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredLanguages: string[];
};

function emptyFormState(): ProfileFormState {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    country: '',
    city: '',
    address: '',
    heightCm: '',
    weightKg: '',
    allergies: '',
    currentMedications: '',
    insuranceProvider: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    preferredLanguages: ['English']
  };
}

function patientToFormState(patient: Patient): ProfileFormState {
  const { firstName, lastName } = splitPatientFullName(patient.full_name);
  return {
    firstName,
    lastName,
    phone: patient.phone ?? '',
    dateOfBirth: patient.date_of_birth ?? '',
    gender: patient.gender ?? '',
    bloodGroup: patient.blood_group ?? '',
    country: patient.country ?? '',
    city: patient.city ?? '',
    address: patient.address ?? '',
    heightCm: patient.height_cm != null ? String(patient.height_cm) : '',
    weightKg: patient.weight_kg != null ? String(patient.weight_kg) : '',
    allergies: patient.allergies ?? '',
    currentMedications: patient.current_medications ?? '',
    insuranceProvider: patient.insurance_provider ?? '',
    emergencyContactName: patient.emergency_contact_name ?? '',
    emergencyContactPhone: patient.emergency_contact_phone ?? '',
    preferredLanguages: parsePreferredLanguages(patient.preferred_language)
  };
}

function parseOptionalNumber(value: string, label: string): { value: number | null; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null, error: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { value: null, error: `Enter a valid ${label} or leave it blank.` };
  }
  return { value: parsed, error: null };
}

function displayValue(value: string | number | null | undefined): string {
  if (value == null) return 'Not set';
  const text = String(value).trim();
  return text || 'Not set';
}

function languageLabel(value: string): string {
  return formatPreferredLanguages(value);
}

type DetailRow = { label: string; value: string };

function profileDetailRows(patient: Patient): DetailRow[] {
  const { firstName, lastName } = splitPatientFullName(patient.full_name);
  return [
    { label: 'First name', value: displayValue(firstName) },
    { label: 'Last name', value: displayValue(lastName) },
    { label: 'Email', value: displayValue(patient.email) },
    { label: 'Phone', value: displayValue(patient.phone) },
    { label: 'Date of birth', value: displayValue(patient.date_of_birth) },
    { label: 'Gender', value: displayValue(patient.gender) },
    { label: 'Blood group', value: displayValue(patient.blood_group) },
    { label: 'Preferred languages', value: languageLabel(patient.preferred_language) },
    { label: 'Address', value: displayValue(patient.address) },
    { label: 'City', value: displayValue(patient.city) },
    { label: 'Country', value: displayValue(patient.country) },
    {
      label: 'Height',
      value: patient.height_cm != null ? `${patient.height_cm} cm` : 'Not set'
    },
    {
      label: 'Weight',
      value: patient.weight_kg != null ? `${patient.weight_kg} kg` : 'Not set'
    },
    { label: 'Allergies', value: displayValue(patient.allergies) },
    { label: 'Current medications', value: displayValue(patient.current_medications) },
    { label: 'Insurance provider', value: displayValue(patient.insurance_provider) },
    { label: 'Emergency contact', value: displayValue(patient.emergency_contact_name) },
    { label: 'Emergency phone', value: displayValue(patient.emergency_contact_phone) },
    { label: 'Patient ID', value: displayValue(patient.elix_id) }
  ];
}

export default function PatientProfileEditSection({
  patientProfile,
  userId
}: PatientProfileEditSectionProps) {
  const { refreshPatientProfile } = useSupabase();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(emptyFormState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!patientProfile) return;
    setForm(patientToFormState(patientProfile));
  }, [patientProfile]);

  const setField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    if (!patientProfile) return;
    setForm(patientToFormState(patientProfile));
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

    const trimmedFirst = form.firstName.trim();
    if (!trimmedFirst) {
      setError('Enter your first name.');
      setSuccess(null);
      return;
    }

    const height = parseOptionalNumber(form.heightCm, 'height');
    if (height.error) {
      setError(height.error);
      setSuccess(null);
      return;
    }

    const weight = parseOptionalNumber(form.weightKg, 'weight');
    if (weight.error) {
      setError(weight.error);
      setSuccess(null);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const { data, error: saveError } = await updatePatientProfileForUser(userId, {
      full_name: joinPatientFullName(trimmedFirst, form.lastName),
      phone: form.phone.trim() || null,
      date_of_birth: form.dateOfBirth.trim() || null,
      gender: form.gender.trim() || null,
      blood_group: form.bloodGroup.trim() || null,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      height_cm: height.value,
      weight_kg: weight.value,
      allergies: form.allergies.trim() || null,
      current_medications: form.currentMedications.trim() || null,
      insurance_provider: form.insuranceProvider.trim() || null,
      emergency_contact_name: form.emergencyContactName.trim() || null,
      emergency_contact_phone: form.emergencyContactPhone.trim() || null,
      preferred_language: serializePreferredLanguages(form.preferredLanguages)
    });
    setBusy(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    await refreshPatientProfile();
    if (data) {
      setForm(patientToFormState(data));
    }
    setSuccess('Profile updated.');
    setEditing(false);
  };

  if (!userId) return null;

  const displayName = patientProfile?.full_name?.trim() || 'Your profile';

  return (
    <SectionCard
      title='Your profile'
      subtitle={
        patientProfile?.elix_id
          ? `Patient ID ${patientProfile.elix_id}`
          : 'Keep your contact and health details up to date'
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

          <p className='patient-profile-edit__section-title'>Personal details</p>
          <div className='patient-profile-edit__grid'>
            <label className='patient-profile-edit__field'>
              <span>First name</span>
              <input
                type='text'
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                autoComplete='given-name'
                required
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field'>
              <span>Last name</span>
              <input
                type='text'
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                autoComplete='family-name'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field patient-profile-edit__field--full'>
              <span>Email</span>
              <input type='email' value={patientProfile.email} disabled readOnly />
            </label>
            <label className='patient-profile-edit__field'>
              <span>Phone number</span>
              <input
                type='tel'
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                autoComplete='tel'
                disabled={busy}
              />
            </label>
            <div className='patient-profile-edit__field'>
              <PatientBirthDatePicker
                value={form.dateOfBirth}
                onChange={(value) => setField('dateOfBirth', value)}
                disabled={busy}
              />
            </div>
            <label className='patient-profile-edit__field'>
              <span>Gender</span>
              <select
                value={form.gender}
                onChange={(e) => setField('gender', e.target.value)}
                disabled={busy}
              >
                <option value=''>Select gender</option>
                {PATIENT_GENDER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className='patient-profile-edit__field'>
              <span>Blood group</span>
              <select
                value={form.bloodGroup}
                onChange={(e) => setField('bloodGroup', e.target.value)}
                disabled={busy}
              >
                <option value=''>Select blood group</option>
                {PATIENT_BLOOD_GROUP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className='patient-profile-edit__field patient-profile-edit__field--full'>
              <PreferredLanguageMultiSelect
                value={form.preferredLanguages}
                onChange={(preferredLanguages) => setField('preferredLanguages', preferredLanguages)}
                disabled={busy}
              />
            </div>
          </div>

          <p className='patient-profile-edit__section-title'>Location</p>
          <div className='patient-profile-edit__grid'>
            <label className='patient-profile-edit__field patient-profile-edit__field--full'>
              <span>Address</span>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                autoComplete='street-address'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field'>
              <span>City</span>
              <input
                type='text'
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                autoComplete='address-level2'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field'>
              <span>Country</span>
              <input
                type='text'
                value={form.country}
                onChange={(e) => setField('country', e.target.value)}
                autoComplete='country-name'
                disabled={busy}
              />
            </label>
          </div>

          <p className='patient-profile-edit__section-title'>Health information</p>
          <div className='patient-profile-edit__grid'>
            <label className='patient-profile-edit__field'>
              <span>Height (cm)</span>
              <input
                type='number'
                min={0}
                step={0.1}
                value={form.heightCm}
                onChange={(e) => setField('heightCm', e.target.value)}
                placeholder='Optional'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field'>
              <span>Weight (kg)</span>
              <input
                type='number'
                min={0}
                step={0.1}
                value={form.weightKg}
                onChange={(e) => setField('weightKg', e.target.value)}
                placeholder='Optional'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field patient-profile-edit__field--full'>
              <span>Allergies</span>
              <textarea
                rows={2}
                value={form.allergies}
                onChange={(e) => setField('allergies', e.target.value)}
                placeholder='Optional'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field patient-profile-edit__field--full'>
              <span>Current medications</span>
              <textarea
                rows={2}
                value={form.currentMedications}
                onChange={(e) => setField('currentMedications', e.target.value)}
                placeholder='Optional'
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field patient-profile-edit__field--full'>
              <span>Insurance provider</span>
              <input
                type='text'
                value={form.insuranceProvider}
                onChange={(e) => setField('insuranceProvider', e.target.value)}
                placeholder='Optional'
                disabled={busy}
              />
            </label>
          </div>

          <p className='patient-profile-edit__section-title'>Emergency contact</p>
          <div className='patient-profile-edit__grid'>
            <label className='patient-profile-edit__field'>
              <span>Contact name</span>
              <input
                type='text'
                value={form.emergencyContactName}
                onChange={(e) => setField('emergencyContactName', e.target.value)}
                disabled={busy}
              />
            </label>
            <label className='patient-profile-edit__field'>
              <span>Contact phone</span>
              <input
                type='tel'
                value={form.emergencyContactPhone}
                onChange={(e) => setField('emergencyContactPhone', e.target.value)}
                disabled={busy}
              />
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
            </button>
          </div>
          <dl className='patient-profile-edit__details-grid'>
            {profileDetailRows(patientProfile).map((row) => (
              <div key={row.label} className='patient-profile-edit__detail-row'>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </SectionCard>
  );
}
