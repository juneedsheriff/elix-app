import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseProvider';
import { fetchDoctorSpecialties } from '../../lib/doctors';
import { createRecommendationOpinionRequest } from '../../lib/opinionRequests';
import { fetchUserMedicalRecords } from '../../lib/records';
import type { MedicalRecord } from '../../types/medicalRecord';

type RecommendationOpinionFormProps = {
  onBack: () => void;
  onSubmitted: (requestId: string) => void;
};

export default function RecommendationOpinionForm({ onBack, onSubmitted }: RecommendationOpinionFormProps) {
  const { user, patientProfile } = useSupabase();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtiesLoading, setSpecialtiesLoading] = useState(true);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSpecialties() {
      setSpecialtiesLoading(true);
      setSpecialtiesError(null);

      const { data, error } = await fetchDoctorSpecialties();
      if (cancelled) return;

      if (error) {
        setSpecialtiesError(error.message);
        setSpecialties([]);
      } else {
        setSpecialties(data ?? []);
      }
      setSpecialtiesLoading(false);
    }

    void loadSpecialties();
    return () => {
      cancelled = true;
    };
  }, []);

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

    if (!selectedSpecialty) {
      setSubmitError('Select a specialty so our team can recommend the right specialists.');
      return;
    }

    const trimmed = message.trim();
    if (!trimmed) {
      setSubmitError('Please describe your case and what you need from a second opinion.');
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

    const { data, error } = await createRecommendationOpinionRequest({
      message: trimmed,
      recordIds: [...selectedIds],
      patientId: user?.id ?? null,
      patientName,
      requestedSpecialty: selectedSpecialty
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    setSubmitted(true);
    if (data?.id) {
      onSubmitted(data.id);
    }
  };

  if (submitted) {
    return (
      <section className='section-card opinion-form-card pmr-recommendation-form'>
        <div className='opinion-success'>
          <CheckCircle2 size={40} aria-hidden />
          <h3>Request submitted</h3>
          <p className='muted'>
            Your second opinion request for <strong>{selectedSpecialty}</strong> was submitted. Our patient
            service team will review your records and recommend suitable specialists for your case.
          </p>
          <button type='button' className='secondary-btn wide' onClick={onBack}>
            Back to my requests
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className='section-card opinion-form-card pmr-recommendation-form' aria-labelledby='recommendation-opinion-title'>
      <div className='section-head'>
        <button type='button' className='text-btn pmr-recommendation-form__back' onClick={onBack}>
          ← Back to options
        </button>
        <h3 id='recommendation-opinion-title'>Get doctor recommendations</h3>
        <p>
          Choose a specialty, share your medical records and case details. Our care team will review your
          information and recommend suitable specialists.
        </p>
      </div>

      <form className='opinion-form' onSubmit={(e) => void handleSubmit(e)}>
        <label className='opinion-message-label'>
          Specialty
          {specialtiesLoading ? (
            <p className='doctor-status' style={{ marginTop: '0.5rem' }}>
              <Loader2 size={18} className='spin' aria-hidden /> Loading specialties…
            </p>
          ) : null}

          {specialtiesError ? (
            <p className='auth-error' role='alert' style={{ marginTop: '0.5rem' }}>
              {specialtiesError}
            </p>
          ) : null}

          {!specialtiesLoading && !specialtiesError ? (
            <select
              className='opinion-select'
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              required
              aria-required='true'
            >
              <option value=''>Select a specialty…</option>
              {specialties.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>
          ) : null}
        </label>

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
          Case details
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

        <button
          type='submit'
          className='primary-btn wide'
          disabled={submitting || specialtiesLoading || specialties.length === 0}
        >
          {submitting ? 'Submitting…' : 'Submit request for recommendations'}
        </button>
      </form>
    </section>
  );
}
