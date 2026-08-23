import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import {
  updateOwnDoctorScheduler,
  type OwnDoctorSchedulerUpdateInput
} from '../../lib/doctors';
import type { Doctor } from '../../types/doctor';
import ConsultationHoursEditor from '../admin/forms/ConsultationHoursEditor';
import '../admin/doctors/doctors-management.css';

type DoctorSchedulerFormProps = {
  doctor: Doctor;
  onSaved: (doctor: Doctor) => void;
};

function formFromDoctor(doctor: Doctor): OwnDoctorSchedulerUpdateInput {
  return {
    scheduler_effect_from: doctor.scheduler_effect_from ?? null,
    scheduler_time_interval: doctor.scheduler_time_interval ?? 15,
    scheduler_color: doctor.scheduler_color?.trim() || '#09abc0',
    elix_patient_priority: Boolean(doctor.elix_patient_priority),
    time_settings: doctor.time_settings ?? {},
    consultation_hours: doctor.consultation_hours
  };
}

export default function DoctorSchedulerForm({ doctor, onSaved }: DoctorSchedulerFormProps) {
  const [form, setForm] = useState<OwnDoctorSchedulerUpdateInput>(() => formFromDoctor(doctor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFromDoctor(doctor));
    setError(null);
    setSuccess(null);
  }, [doctor]);

  const setField = <K extends keyof OwnDoctorSchedulerUpdateInput>(
    key: K,
    value: OwnDoctorSchedulerUpdateInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    const { data, error: saveError } = await updateOwnDoctorScheduler(form);
    setBusy(false);

    if (saveError || !data) {
      setError(saveError?.message ?? 'Could not save scheduler settings.');
      return;
    }

    setForm(formFromDoctor(data));
    setSuccess('Scheduler settings saved.');
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

      <h3 className='elixhealth-form-section-title'>Scheduler details</h3>
      <div className='elixhealth-form-grid elixhealth-form-grid--4'>
        <label className='elixhealth-field'>
          <span>Effect from</span>
          <input
            type='date'
            value={form.scheduler_effect_from ?? ''}
            onChange={(e) => setField('scheduler_effect_from', e.target.value || null)}
            disabled={busy}
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
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
          <span>Calendar color</span>
          <input
            type='color'
            className='elixhealth-color-input'
            value={form.scheduler_color}
            onChange={(e) => setField('scheduler_color', e.target.value)}
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field elixhealth-field--checkbox'>
          <input
            type='checkbox'
            checked={form.elix_patient_priority}
            onChange={(e) => setField('elix_patient_priority', e.target.checked)}
            disabled={busy}
          />
          <span>ElixClinix patient will be treated as priority</span>
        </label>
      </div>

      <h3 className='elixhealth-form-section-title'>Time settings</h3>
      <div className='elixhealth-form-grid elixhealth-form-grid--4'>
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
            disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
          />
        </label>
        <label className='elixhealth-field'>
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
            disabled={busy}
          />
        </label>
      </div>

      <ConsultationHoursEditor
        value={form.consultation_hours}
        onChange={(consultation_hours) => setField('consultation_hours', consultation_hours)}
      />

      <div className='elixhealth-form-actions elixhealth-form-actions--end'>
        <button type='submit' className='primary-btn elixhealth-save-btn' disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={14} className='spin' aria-hidden /> Saving…
            </>
          ) : (
            'Save scheduler'
          )}
        </button>
      </div>
    </form>
  );
}
