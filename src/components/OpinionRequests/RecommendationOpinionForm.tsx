import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseProvider';
import { appScreenPath } from '../../lib/navigation/appRoutes';
import {
  clearPendingOpinionRequest,
  savePendingOpinionRequest
} from '../../lib/navigation/pendingOpinionRequest';
import ConsultationDurationSelect from '../ConsultationWorkflow/ConsultationDurationSelect';
import MedicalRecordsChoicePrompt from './MedicalRecordsChoicePrompt';
import PatientCaseDetailsForm from './PatientCaseDetailsForm';
import {
  preferredDurationTiers,
  STANDARD_CONSULTATION_DURATIONS
} from '../../lib/consultationTiers';
import { fetchDoctorSpecialties } from '../../lib/doctors';
import {
  emptyPatientCaseDetails,
  serializePatientCaseDetails,
  validatePatientCaseDetails
} from '../../lib/patientCaseDetails';
import { createRecommendationOpinionRequest } from '../../lib/opinionRequests';
import { fetchUserMedicalRecords } from '../../lib/records';
import MedicalRecordSelectList from '../Records/MedicalRecordSelectList';
import type { MedicalRecord } from '../../types/medicalRecord';
import type { PatientCaseDetails } from '../../types/patientCaseDetails';
import './patient-case-details-form.css';

type RecommendationOpinionFormProps = {
  onBack: () => void;
  onSubmitted: (requestId: string) => void;
};

export default function RecommendationOpinionForm({ onBack, onSubmitted }: RecommendationOpinionFormProps) {
  const navigate = useNavigate();
  const { user, patientProfile } = useSupabase();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtiesLoading, setSpecialtiesLoading] = useState(true);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [caseDetails, setCaseDetails] = useState<PatientCaseDetails>(() => emptyPatientCaseDetails());
  const [consultationDurationMinutes, setConsultationDurationMinutes] = useState<number>(
    STANDARD_CONSULTATION_DURATIONS[1]
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [proceedWithoutRecords, setProceedWithoutRecords] = useState(false);
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
      setProceedWithoutRecords(false);

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

    const validationError = validatePatientCaseDetails(caseDetails, {
      requireConsent: true,
      requireSpecialty: true,
      submitOnly: true
    });
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    if (records.length === 0 && !proceedWithoutRecords) {
      return;
    }
    if (!consultationDurationMinutes) {
      setSubmitError('Choose how long you need for the consultation.');
      return;
    }

    const serialized = serializePatientCaseDetails(caseDetails);
    const message = '';
    const selectedSpecialty = caseDetails.specialtyRequired.trim();

    setSubmitting(true);
    const patientName =
      patientProfile?.full_name ??
      (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) ??
      user?.email ??
      null;

    const { data, error } = await createRecommendationOpinionRequest({
      message,
      recordIds: [...selectedIds],
      patientId: user?.id ?? null,
      patientName,
      requestedSpecialty: selectedSpecialty,
      consultationDurationMinutes,
      caseDetails: serialized
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    setSubmitted(true);
    clearPendingOpinionRequest();
    if (data?.id) {
      onSubmitted(data.id);
    }
  };

  const handleUploadRecords = () => {
    savePendingOpinionRequest({ flow: 'recommendation-opinion' });
    navigate(appScreenPath('upload-records'));
  };

  const awaitingRecordsChoice =
    Boolean(user?.id) && !recordsLoading && !recordsError && records.length === 0 && !proceedWithoutRecords;

  if (submitted) {
    return (
      <section className='section-card opinion-form-card pmr-recommendation-form'>
        <div className='opinion-success'>
          <CheckCircle2 size={40} aria-hidden />
          <h3>Request submitted</h3>
          <p className='muted'>
            Your second opinion request for <strong>{caseDetails.specialtyRequired}</strong> was submitted. Our patient
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
        {!awaitingRecordsChoice ? (
          <>
        <ConsultationDurationSelect
          tiers={preferredDurationTiers()}
          value={consultationDurationMinutes}
          onChange={setConsultationDurationMinutes}
          disabled={submitting || specialtiesLoading}
          label='Preferred consultation duration'
          hint='Choose how long you need with the specialist. Exact pricing will be shown when doctors are recommended for your case.'
          showFees={false}
        />

        {specialtiesError ? (
          <p className='auth-error' role='alert'>
            {specialtiesError}
          </p>
        ) : null}

        <label className='opinion-message-label'>
          Specialty required
          <select
            className='opinion-select'
            value={caseDetails.specialtyRequired}
            onChange={(event) =>
              setCaseDetails((prev) => ({ ...prev, specialtyRequired: event.target.value }))
            }
            disabled={submitting || specialtiesLoading || specialties.length === 0}
          >
            <option value=''>Select a specialty…</option>
            {specialties.map((specialty) => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </label>

        <PatientCaseDetailsForm
          value={caseDetails}
          onChange={setCaseDetails}
          specialties={specialties}
          specialtyMode='patient_select'
          showCaseSections={false}
          showPreferences
          showConsent
          disabled={submitting || specialtiesLoading || specialties.length === 0}
        />
          </>
        ) : null}

        <fieldset className='opinion-fieldset'>
          <legend>Select medical records (optional)</legend>
          {records.length > 0 ? (
            <p className='muted opinion-fieldset-hint'>
              Share any records you would like our team to review, or continue without selecting any.
            </p>
          ) : null}
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

          {awaitingRecordsChoice ? (
            <MedicalRecordsChoicePrompt
              onUpload={handleUploadRecords}
              onProceedWithout={() => {
                setProceedWithoutRecords(true);
                setSubmitError(null);
              }}
              disabled={submitting}
            />
          ) : null}

          {proceedWithoutRecords && records.length === 0 ? (
            <p className='muted'>Continuing without medical records. You can upload files later if needed.</p>
          ) : null}

          <MedicalRecordSelectList
            records={records}
            selectedIds={selectedIds}
            onToggle={toggleRecord}
            disabled={submitting}
          />
        </fieldset>

        {!awaitingRecordsChoice ? (
          <>
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
          </>
        ) : null}
      </form>
    </section>
  );
}
