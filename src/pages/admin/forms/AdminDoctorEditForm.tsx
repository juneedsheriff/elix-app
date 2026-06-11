import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { deleteDoctorForAdmin, setDoctorVisibilityForAdmin, updateDoctorForAdmin } from '../../../lib/admins';
import {
  CONSULTATION_CURRENCY_OPTIONS,
  consultationCurrencySymbol,
  normalizeConsultationCurrency
} from '../../../lib/consultationCurrency';
import { doctorToAdminInput } from '../../../lib/doctorProfile';
import type { AdminDoctorUpdateInput, Doctor } from '../../../types/doctor';
import ConsultationHoursEditor from './ConsultationHoursEditor';
import AdminAccountAccessPanel from './AdminAccountAccessPanel';
import AdminDoctorProfileImageSection from './AdminDoctorProfileImageSection';

type DoctorEditTab = 'profile' | 'clinic' | 'scheduler' | 'login';

type AdminDoctorEditFormProps = {
  doctor: Doctor;
  onSaved: (doctor: Doctor) => void;
  onAuthChanged?: () => void;
  readOnly?: boolean;
};

const TABS: { id: DoctorEditTab; label: string }[] = [
  { id: 'profile', label: 'Doctor profile' },
  { id: 'clinic', label: 'Clinic details' },
  { id: 'scheduler', label: 'Scheduler' },
  { id: 'login', label: 'Login' }
];

export default function AdminDoctorEditForm({ doctor, onSaved, onAuthChanged, readOnly = false }: AdminDoctorEditFormProps) {
  const visibleTabs = readOnly ? TABS.filter((tab) => tab.id !== 'login') : TABS;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as DoctorEditTab | null;
  const activeTab: DoctorEditTab =
    readOnly && tabParam === 'login'
      ? 'profile'
      : tabParam === 'clinic' || tabParam === 'scheduler' || tabParam === 'login'
        ? tabParam
        : 'profile';

  const [form, setForm] = useState<AdminDoctorUpdateInput>(() => doctorToAdminInput(doctor));
  const [busy, setBusy] = useState(false);
  const [manageBusy, setManageBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageMessage, setManageMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(doctorToAdminInput(doctor));
    setError(null);
    setManageMessage(null);
  }, [doctor]);

  const setTab = (tab: DoctorEditTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'profile') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const setField = <K extends keyof AdminDoctorUpdateInput>(key: K, value: AdminDoctorUpdateInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await updateDoctorForAdmin(doctor.id, form);
    setBusy(false);

    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save doctor profile.');
      return;
    }

    onSaved(data);
  };

  const handleToggleVisibility = async () => {
    setManageBusy(true);
    setManageMessage(null);
    setError(null);

    const nextVisible = doctor.is_visible === false;
    const { error: visibilityError } = await setDoctorVisibilityForAdmin(doctor.id, nextVisible);
    setManageBusy(false);

    if (visibilityError) {
      setError(visibilityError.message);
      return;
    }

    setManageMessage(`Doctor is now ${nextVisible ? 'visible in' : 'hidden from'} patient search.`);
    onAuthChanged?.(); // also refresh doctor row data
  };

  const handleDeleteDoctor = async () => {
    const confirmed = window.confirm(
      `Delete ${doctor.full_name}? This hides the doctor from patient search and removes them from the active admin list.`
    );
    if (!confirmed) return;

    setManageBusy(true);
    setManageMessage(null);
    setError(null);

    const { error: deleteError } = await deleteDoctorForAdmin(doctor.id);
    setManageBusy(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setManageMessage('Doctor deleted from active listings.');
    onSaved(doctor);
  };

  return (
    <form className='elixhealth-form' onSubmit={(e) => void handleSubmit(e)}>
      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      {manageMessage ? (
        <p className='elixhealth-success' role='status'>
          {manageMessage}
        </p>
      ) : null}

      <div className='elixhealth-profile-tabs' role='tablist' aria-label='Doctor profile sections'>
        {visibleTabs.map(({ id, label }) => (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={activeTab === id}
            className={
              activeTab === id ? 'elixhealth-profile-tab elixhealth-profile-tab--active' : 'elixhealth-profile-tab'
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <fieldset disabled={readOnly || busy} className='elixhealth-form-fieldset'>

      {activeTab === 'profile' ? (
        <div className='elixhealth-tab-panel' role='tabpanel'>
          <AdminDoctorProfileImageSection
            imageUrl={form.image_url}
            displayName={form.full_name}
            onChange={(url) => setField('image_url', url)}
            disabled={busy || manageBusy}
            readOnly={readOnly}
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
              <span>Years of experience</span>
              <input
                type='number'
                min={0}
                value={form.years_experience}
                onChange={(e) => setField('years_experience', Number(e.target.value))}
              />
            </label>
            <label className='elixhealth-field'>
              <span>Rating (0–5)</span>
              <input
                type='number'
                min={0}
                max={5}
                step={0.1}
                value={form.rating}
                onChange={(e) => setField('rating', Number(e.target.value))}
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
            <label className='elixhealth-field elixhealth-field--full'>
              <span>Work experience</span>
              <textarea
                rows={3}
                value={form.work_experience ?? ''}
                onChange={(e) => setField('work_experience', e.target.value || null)}
              />
            </label>
            <label className='elixhealth-field elixhealth-field--full'>
              <span>Awards &amp; recognitions</span>
              <textarea
                rows={2}
                value={form.awards_recognitions ?? ''}
                onChange={(e) => setField('awards_recognitions', e.target.value || null)}
              />
            </label>
            <label className='elixhealth-field elixhealth-field--full'>
              <span>Membership</span>
              <textarea
                rows={2}
                value={form.membership ?? ''}
                onChange={(e) => setField('membership', e.target.value || null)}
              />
            </label>
          </div>
          {!readOnly ? (
            <>
              <h3 className='elixhealth-form-section-title'>Doctor visibility</h3>
              <div className='elixhealth-auth-status-row'>
                <span>Patient search</span>
                <strong className={doctor.is_visible === false ? 'elixhealth-badge' : 'elixhealth-badge elixhealth-badge--ok'}>
                  {doctor.is_visible === false ? 'Hidden' : 'Visible'}
                </strong>
              </div>
              <div className='elixhealth-auth-actions'>
                <button
                  type='button'
                  className='secondary-btn'
                  disabled={manageBusy || busy}
                  onClick={() => void handleToggleVisibility()}
                >
                  {manageBusy ? <Loader2 size={16} className='spin' aria-hidden /> : doctor.is_visible === false ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                  {doctor.is_visible === false ? 'Show in search' : 'Hide from search'}
                </button>
                <button
                  type='button'
                  className='secondary-btn elixhealth-row-action--danger'
                  disabled={manageBusy || busy}
                  onClick={() => void handleDeleteDoctor()}
                >
                  {manageBusy ? <Loader2 size={16} className='spin' aria-hidden /> : <Trash2 size={16} aria-hidden />}
                  Delete doctor
                </button>
              </div>
            </>
          ) : null}
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

      {activeTab === 'scheduler' ? (
        <div className='elixhealth-tab-panel' role='tabpanel'>
          <h3 className='elixhealth-form-section-title'>Scheduler details</h3>
          <div className='elixhealth-form-grid'>
            <label className='elixhealth-field'>
              <span>Effect from</span>
              <input
                type='date'
                value={form.scheduler_effect_from ?? ''}
                onChange={(e) => setField('scheduler_effect_from', e.target.value || null)}
              />
            </label>
            <label className='elixhealth-field'>
              <span>Time interval (minutes)</span>
              <input
                type='number'
                min={5}
                step={5}
                value={form.scheduler_time_interval ?? ''}
                onChange={(e) =>
                  setField('scheduler_time_interval', e.target.value ? Number(e.target.value) : null)
                }
              />
            </label>
            <label className='elixhealth-field'>
              <span>Consultation currency</span>
              <select
                value={form.consultation_currency}
                onChange={(e) =>
                  setField('consultation_currency', normalizeConsultationCurrency(e.target.value))
                }
              >
                {CONSULTATION_CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {form.consultation_tiers.map((tier) => (
              <label key={tier.duration_minutes} className='elixhealth-field'>
                <span>
                  {tier.duration_minutes === 60 ? '1 hour' : `${tier.duration_minutes} min`} consultation
                  fee ({consultationCurrencySymbol(form.consultation_currency)})
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
            <label className='elixhealth-field'>
              <span>Calendar color</span>
              <input
                type='color'
                className='elixhealth-color-input'
                value={form.scheduler_color}
                onChange={(e) => setField('scheduler_color', e.target.value)}
              />
            </label>
            <label className='elixhealth-field elixhealth-field--checkbox'>
              <input
                type='checkbox'
                checked={form.elix_patient_priority}
                onChange={(e) => setField('elix_patient_priority', e.target.checked)}
              />
              <span>Elix patient will be treated as priority</span>
            </label>
          </div>

          <h3 className='elixhealth-form-section-title'>Time settings</h3>
          <div className='elixhealth-form-grid'>
            <label className='elixhealth-field'>
              <span>Buffer (minutes)</span>
              <input
                type='number'
                min={0}
                value={form.time_settings.buffer_minutes ?? ''}
                onChange={(e) =>
                  setField('time_settings', {
                    ...form.time_settings,
                    buffer_minutes: e.target.value ? Number(e.target.value) : undefined
                  })
                }
              />
            </label>
            <label className='elixhealth-field'>
              <span>Lunch break start</span>
              <input
                type='time'
                value={form.time_settings.lunch_break_start ?? ''}
                onChange={(e) =>
                  setField('time_settings', {
                    ...form.time_settings,
                    lunch_break_start: e.target.value || undefined
                  })
                }
              />
            </label>
            <label className='elixhealth-field'>
              <span>Lunch break end</span>
              <input
                type='time'
                value={form.time_settings.lunch_break_end ?? ''}
                onChange={(e) =>
                  setField('time_settings', {
                    ...form.time_settings,
                    lunch_break_end: e.target.value || undefined
                  })
                }
              />
            </label>
            <label className='elixhealth-field elixhealth-field--full'>
              <span>Time settings notes</span>
              <textarea
                rows={2}
                value={form.time_settings.notes ?? ''}
                onChange={(e) =>
                  setField('time_settings', {
                    ...form.time_settings,
                    notes: e.target.value || undefined
                  })
                }
              />
            </label>
          </div>

          <h3 className='elixhealth-form-section-title'>Consultation hours</h3>
          <ConsultationHoursEditor
            value={form.consultation_hours}
            onChange={(consultation_hours) => setField('consultation_hours', consultation_hours)}
          />
        </div>
      ) : null}

      {activeTab === 'login' && !readOnly ? (
        <div className='elixhealth-tab-panel' role='tabpanel'>
          <AdminAccountAccessPanel
            role='doctor'
            profileId={doctor.id}
            profileEmail={doctor.email}
            authUserId={doctor.auth_user_id}
            loginDisabled={doctor.login_disabled}
            onAuthChanged={onAuthChanged}
          />
        </div>
      ) : null}

      {activeTab !== 'login' && !readOnly ? (
      <div className='elixhealth-form-actions'>
        <button type='submit' className='primary-btn' disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={16} className='spin' aria-hidden /> Saving…
            </>
          ) : (
            'Save all changes'
          )}
        </button>
      </div>
      ) : null}
      </fieldset>
    </form>
  );
}
