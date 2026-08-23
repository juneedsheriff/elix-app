import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import PreferredLanguageMultiSelect from '../../components/patient/PreferredLanguageMultiSelect';
import { parsePreferredLanguages } from '../../lib/patientProfileOptions';
import {
  updateOwnDoctorProfile,
  type OwnDoctorProfileUpdateInput
} from '../../lib/doctors';
import { DEFAULT_DOCTOR_IMAGE_PLACEHOLDER } from '../../lib/doctorProfile';
import type { Doctor } from '../../types/doctor';
import AdminDoctorProfileImageSection from '../admin/forms/AdminDoctorProfileImageSection';
import '../admin/doctors/doctors-management.css';

type DoctorMyProfileFormProps = {
  doctor: Doctor;
  onSaved: (doctor: Doctor) => void;
};

function formFromDoctor(doctor: Doctor): OwnDoctorProfileUpdateInput {
  return {
    full_name: doctor.full_name ?? '',
    gender: doctor.gender ?? null,
    mobile_no: doctor.mobile_no ?? doctor.phone ?? '',
    qualification: doctor.qualification ?? null,
    specialization: doctor.specialization ?? null,
    about_doctor: doctor.about_doctor ?? doctor.bio ?? null,
    work_experience: doctor.work_experience ?? null,
    awards_recognitions: doctor.awards_recognitions ?? null,
    membership: doctor.membership ?? null,
    languages: doctor.languages ?? '',
    image_url: doctor.image_url?.trim() || DEFAULT_DOCTOR_IMAGE_PLACEHOLDER
  };
}

export default function DoctorMyProfileForm({ doctor, onSaved }: DoctorMyProfileFormProps) {
  const [form, setForm] = useState<OwnDoctorProfileUpdateInput>(() => formFromDoctor(doctor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFromDoctor(doctor));
    setError(null);
    setSuccess(null);
  }, [doctor]);

  const setField = <K extends keyof OwnDoctorProfileUpdateInput>(
    key: K,
    value: OwnDoctorProfileUpdateInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    const { data, error: saveError } = await updateOwnDoctorProfile(form);
    setBusy(false);

    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save profile.');
      return;
    }

    setForm(formFromDoctor(data));
    setSuccess('Profile updated.');
    onSaved(data);
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

      <AdminDoctorProfileImageSection
        imageUrl={form.image_url}
        displayName={form.full_name}
        onChange={(url) => setField('image_url', url)}
        disabled={busy}
      />

      <h3 className='elixhealth-form-section-title'>Personal</h3>
      <div className='elixhealth-form-grid elixhealth-form-grid--4'>
        <label className='elixhealth-field'>
          <span>
            Full name <span className='elixhealth-required'>*</span>
          </span>
          <input
            type='text'
            value={form.full_name}
            onChange={(e) => setField('full_name', e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Gender</span>
          <select
            value={form.gender ?? ''}
            onChange={(e) => setField('gender', e.target.value || null)}
            disabled={busy}
          >
            <option value=''>Please select</option>
            <option value='Male'>Male</option>
            <option value='Female'>Female</option>
            <option value='Other'>Other</option>
          </select>
        </label>
        <label className='elixhealth-field'>
          <span>Mobile no.</span>
          <input
            type='tel'
            value={form.mobile_no}
            onChange={(e) => setField('mobile_no', e.target.value)}
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Email (login)</span>
          <input type='email' value={doctor.email} readOnly disabled />
        </label>
        <label className='elixhealth-field'>
          <span>Specialty</span>
          <input type='text' value={doctor.specialty} readOnly disabled />
        </label>
      </div>

      <h3 className='elixhealth-form-section-title'>Professional details</h3>
      <div className='elixhealth-form-grid elixhealth-form-grid--4'>
        <label className='elixhealth-field'>
          <span>Qualification</span>
          <input
            type='text'
            value={form.qualification ?? ''}
            onChange={(e) => setField('qualification', e.target.value || null)}
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Specialization</span>
          <input
            type='text'
            value={form.specialization ?? ''}
            onChange={(e) => setField('specialization', e.target.value || null)}
            disabled={busy}
          />
        </label>
        <div className='elixhealth-field elixhealth-field--span-2'>
          <PreferredLanguageMultiSelect
            label='Languages'
            value={parsePreferredLanguages(form.languages)}
            onChange={(languages) => setField('languages', languages.join(', '))}
            disabled={busy}
          />
        </div>
      </div>

      <h3 className='elixhealth-form-section-title'>Profile details</h3>
      <div className='elixhealth-form-grid elixhealth-form-grid--2'>
        <label className='elixhealth-field'>
          <span>About doctor</span>
          <textarea
            rows={3}
            value={form.about_doctor ?? ''}
            onChange={(e) => setField('about_doctor', e.target.value || null)}
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Work experience</span>
          <textarea
            rows={3}
            value={form.work_experience ?? ''}
            onChange={(e) => setField('work_experience', e.target.value || null)}
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Awards &amp; recognitions</span>
          <textarea
            rows={2}
            value={form.awards_recognitions ?? ''}
            onChange={(e) => setField('awards_recognitions', e.target.value || null)}
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Membership</span>
          <textarea
            rows={2}
            value={form.membership ?? ''}
            onChange={(e) => setField('membership', e.target.value || null)}
            disabled={busy}
          />
        </label>
      </div>

      <p className='muted'>
        Specialty and login email are managed by ElixClinix admin. Change password via Forgot password on
        the sign-in screen.
      </p>

      <div className='elixhealth-form-actions elixhealth-form-actions--end'>
        <button type='submit' className='primary-btn elixhealth-save-btn' disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} className='spin' aria-hidden /> Saving…
            </>
          ) : (
            'Save profile'
          )}
        </button>
      </div>
    </form>
  );
}
