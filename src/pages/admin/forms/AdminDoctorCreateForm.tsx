import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { createDoctorForAdmin } from '../../../lib/admins';
import { emptyAdminDoctorInput, validateAdminDoctorInput } from '../../../lib/doctorProfile';
import AdminDoctorProfileImageSection from './AdminDoctorProfileImageSection';
import type { AdminDoctorUpdateInput, Doctor } from '../../../types/doctor';

type CreateTab = 'profile' | 'clinic';

type AdminDoctorCreateFormProps = {
  onCreated: (doctor: Doctor) => void;
  onCancel: () => void;
};

const TABS: { id: CreateTab; label: string }[] = [
  { id: 'profile', label: 'Doctor profile' },
  { id: 'clinic', label: 'Clinic details' }
];

export default function AdminDoctorCreateForm({ onCreated, onCancel }: AdminDoctorCreateFormProps) {
  const [activeTab, setActiveTab] = useState<CreateTab>('profile');
  const [form, setForm] = useState<AdminDoctorUpdateInput>(() => emptyAdminDoctorInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof AdminDoctorUpdateInput>(key: K, value: AdminDoctorUpdateInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateAdminDoctorInput(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    const { data, error: createError } = await createDoctorForAdmin(form);
    setBusy(false);

    if (createError || !data) {
      setError(createError?.message ?? 'Could not create doctor.');
      return;
    }

    onCreated(data);
  };

  return (
    <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      <p className='muted elixhealth-form-intro'>
        Create a provider profile. After saving, you can set scheduler options and doctor login on the edit
        screen.
      </p>

      <div className='elixhealth-profile-tabs' role='tablist' aria-label='New doctor sections'>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={activeTab === id}
            className={
              activeTab === id ? 'elixhealth-profile-tab elixhealth-profile-tab--active' : 'elixhealth-profile-tab'
            }
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <fieldset disabled={busy} className='elixhealth-form-fieldset'>
        {activeTab === 'profile' ? (
          <div className='elixhealth-tab-panel' role='tabpanel'>
            <AdminDoctorProfileImageSection
              imageUrl={form.image_url}
              displayName={form.full_name}
              onChange={(url) => setField('image_url', url)}
              disabled={busy}
            />

            <h3 className='elixhealth-form-section-title'>Personal</h3>
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
                <span>Gender</span>
                <select value={form.gender ?? ''} onChange={(e) => setField('gender', e.target.value || null)}>
                  <option value=''>—</option>
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
                  required
                />
              </label>
              <label className='elixhealth-field'>
                <span>Email ID</span>
                <input
                  type='email'
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  required
                />
              </label>
            </div>

            <h3 className='elixhealth-form-section-title'>Professional details</h3>
            <div className='elixhealth-form-grid'>
              <label className='elixhealth-field'>
                <span>Medical license no.</span>
                <input
                  type='text'
                  value={form.medical_license_no ?? ''}
                  onChange={(e) => setField('medical_license_no', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field'>
                <span>Qualification</span>
                <input
                  type='text'
                  value={form.qualification ?? ''}
                  onChange={(e) => setField('qualification', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field'>
                <span>Start of practice</span>
                <input
                  type='date'
                  value={form.start_of_practice ?? ''}
                  onChange={(e) => setField('start_of_practice', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field'>
                <span>Specialty</span>
                <input
                  type='text'
                  value={form.specialty}
                  onChange={(e) => setField('specialty', e.target.value)}
                  required
                />
              </label>
              <label className='elixhealth-field'>
                <span>Specialization</span>
                <input
                  type='text'
                  value={form.specialization ?? ''}
                  onChange={(e) => setField('specialization', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field'>
                <span>Languages</span>
                <input
                  type='text'
                  value={form.languages}
                  onChange={(e) => setField('languages', e.target.value)}
                  required
                />
              </label>
            </div>

            <h3 className='elixhealth-form-section-title'>Profile details</h3>
            <div className='elixhealth-form-grid'>
              <label className='elixhealth-field elixhealth-field--full'>
                <span>About doctor</span>
                <textarea
                  rows={3}
                  value={form.about_doctor ?? ''}
                  onChange={(e) => setField('about_doctor', e.target.value || null)}
                />
              </label>
            </div>
          </div>
        ) : null}

        {activeTab === 'clinic' ? (
          <div className='elixhealth-tab-panel' role='tabpanel'>
            <h3 className='elixhealth-form-section-title'>Clinic details</h3>
            <div className='elixhealth-form-grid'>
              <label className='elixhealth-field'>
                <span>Clinic name</span>
                <input
                  type='text'
                  value={form.clinic_name}
                  onChange={(e) => setField('clinic_name', e.target.value)}
                  required
                />
              </label>
              <label className='elixhealth-field'>
                <span>Specialization</span>
                <input
                  type='text'
                  value={form.clinic_specialization ?? ''}
                  onChange={(e) => setField('clinic_specialization', e.target.value || null)}
                />
              </label>
              {form.consultation_tiers.map((tier) => (
                <label key={tier.duration_minutes} className='elixhealth-field'>
                  <span>
                    {tier.duration_minutes === 60 ? '1 hour' : `${tier.duration_minutes} min`} consultation
                    fee (USD)
                  </span>
                  <input
                    type='number'
                    min={0}
                    value={tier.fee_usd}
                    onChange={(e) =>
                      setField(
                        'consultation_tiers',
                        form.consultation_tiers.map((item) =>
                          item.duration_minutes === tier.duration_minutes
                            ? { ...item, fee_usd: Number(e.target.value) }
                            : item
                        )
                      )
                    }
                    required
                  />
                </label>
              ))}
              <label className='elixhealth-field elixhealth-field--full'>
                <span>About clinic</span>
                <textarea
                  rows={3}
                  value={form.about_clinic ?? ''}
                  onChange={(e) => setField('about_clinic', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field elixhealth-field--full'>
                <span>Website</span>
                <input
                  type='url'
                  value={form.clinic_website ?? ''}
                  onChange={(e) => setField('clinic_website', e.target.value || null)}
                  placeholder='https://'
                />
              </label>
            </div>

            <h3 className='elixhealth-form-section-title'>Clinic address</h3>
            <div className='elixhealth-form-grid'>
              <label className='elixhealth-field'>
                <span>Country</span>
                <input
                  type='text'
                  value={form.clinic_country}
                  onChange={(e) => setField('clinic_country', e.target.value)}
                  required
                />
              </label>
              <label className='elixhealth-field'>
                <span>State</span>
                <input
                  type='text'
                  value={form.clinic_state ?? ''}
                  onChange={(e) => setField('clinic_state', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field'>
                <span>City</span>
                <input
                  type='text'
                  value={form.clinic_city ?? ''}
                  onChange={(e) => setField('clinic_city', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field'>
                <span>Location</span>
                <input
                  type='text'
                  value={form.clinic_location ?? ''}
                  onChange={(e) => setField('clinic_location', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field elixhealth-field--full'>
                <span>Street</span>
                <input
                  type='text'
                  value={form.clinic_street ?? ''}
                  onChange={(e) => setField('clinic_street', e.target.value || null)}
                />
              </label>
              <label className='elixhealth-field'>
                <span>Zipcode</span>
                <input
                  type='text'
                  value={form.clinic_zipcode ?? ''}
                  onChange={(e) => setField('clinic_zipcode', e.target.value || null)}
                />
              </label>
            </div>
          </div>
        ) : null}

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
              'Create doctor'
            )}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
