import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseProvider';
import { createOpinionRequest } from '../../lib/opinionRequests';
import { fetchUserMedicalRecords } from '../../lib/records';
import type { Doctor } from '../../types/doctor';
import type { MedicalRecord } from '../../types/medicalRecord';

type GetOpinionFormProps = {
  doctor: Doctor;
  onBack: () => void;
};

export default function GetOpinionForm({ doctor, onBack }: GetOpinionFormProps) {
  const { user, patientProfile } = useSupabase();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setRecordsLoading(true);
      setRecordsError(null);
      setSelectedIds(new Set());

      if (!user?.id) {
        if (!cancelled) {
          setRecords([]);
          setRecordsLoading(false);
        }
        return;
      }

      const { data, error } = await fetchUserMedicalRecords(user.id);
      if (cancelled) return;

      if (error) {
        setRecordsError(error.message);
        setRecords([]);
      } else {
        setRecords(data ?? []);
      }
      setRecordsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleRecord = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const trimmed = message.trim();
    if (!trimmed) {
      setSubmitError('Please describe your case and questions for the doctor.');
      return;
    }
    if (selectedIds.size === 0) {
      setSubmitError('Select at least one medical record to share.');
      return;
    }

    setSubmitting(true);
    const patientName =
      patientProfile?.full_name ??
      (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) ??
      user?.email ??
      null;

    const { error } = await createOpinionRequest({
      doctorId: doctor.id,
      doctorName: doctor.full_name,
      message: trimmed,
      recordIds: [...selectedIds],
      patientId: user?.id ?? null,
      patientName
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(
        `${error.message}. Run supabase/schema.sql (uploaded_files table) and npm run db:seed-records, then try again.`
      );
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section className='section-card opinion-form-card'>
        <div className='opinion-success'>
          <CheckCircle2 size={40} aria-hidden />
          <h3>Request submitted</h3>
          <p className='muted'>
            Your second opinion request was submitted. An admin will assign it to our patient service team, who will coordinate with you and {doctor.full_name}.
          </p>
          <button type='button' className='primary-btn wide' onClick={onBack}>
            Back to profile
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className='section-card opinion-form-card' aria-labelledby='get-opinion-title'>
      <div className='section-head'>
        <h3 id='get-opinion-title'>Request second opinion</h3>
        <p>
          Send selected records and a message to <strong>{doctor.full_name}</strong> ({doctor.specialty})
        </p>
      </div>

      <form className='opinion-form' onSubmit={(e) => void handleSubmit(e)}>
        <fieldset className='opinion-fieldset'>
          <legend>Select medical records</legend>
          {recordsLoading ? (
            <p className='doctor-status'>
              <Loader2 size={18} className='spin' aria-hidden /> Loading your records…
            </p>
          ) : null}

          {recordsError ? (
            <p className='auth-error' role='alert'>
              {recordsError}
            </p>
          ) : null}

          {!user?.id ? (
            <p className='muted'>Sign in as a patient to see and share your uploaded records.</p>
          ) : null}

          {!recordsLoading && !recordsError && user?.id && records.length === 0 ? (
            <p className='muted'>You have not uploaded any records yet. Add files under Upload Records first.</p>
          ) : null}

          <ul className='record-select-list'>
            {records.map((record) => (
              <li key={record.id}>
                <label className='record-select-item'>
                  <input
                    type='checkbox'
                    checked={selectedIds.has(record.id)}
                    onChange={() => toggleRecord(record.id)}
                  />
                  <FileText size={20} aria-hidden />
                  <span className='record-select-text'>
                    <strong>{record.file_name}</strong>
                    {record.summary ? <span className='muted'>{record.summary}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <label className='opinion-message-label'>
          Message to doctor
          <textarea
            className='opinion-message'
            rows={5}
            placeholder='Describe your symptoms, diagnosis questions, treatment history, and what you need from this second opinion…'
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            aria-required='true'
          />
        </label>

        {submitError ? (
          <p className='auth-error' role='alert'>
            {submitError}
          </p>
        ) : null}

        <button type='submit' className='primary-btn wide' disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>
    </section>
  );
}
