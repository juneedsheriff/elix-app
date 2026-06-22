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
import MedicalRecordsChoicePrompt from '../OpinionRequests/MedicalRecordsChoicePrompt';
import PatientCaseDetailsForm from '../OpinionRequests/PatientCaseDetailsForm';
import { normalizeConsultationCurrency } from '../../lib/consultationCurrency';
import { getOfferedConsultationTiers, STANDARD_CONSULTATION_DURATIONS } from '../../lib/consultationTiers';
import { fetchDoctorSpecialties } from '../../lib/doctors';
import {
  emptyPatientCaseDetails,
  serializePatientCaseDetails,
  validatePatientCaseDetails
} from '../../lib/patientCaseDetails';
import { createOpinionRequest } from '../../lib/opinionRequests';
import { fetchUserMedicalRecords } from '../../lib/records';
import MedicalRecordSelectList from '../Records/MedicalRecordSelectList';
import type { Doctor } from '../../types/doctor';
import type { MedicalRecord } from '../../types/medicalRecord';
import type { PatientCaseDetails } from '../../types/patientCaseDetails';
import '../OpinionRequests/patient-case-details-form.css';

type GetOpinionFormProps = {
  doctor: Doctor;
  onBack: () => void;
};

const MY_REQUESTS_REDIRECT_MS = 5000;

export default function GetOpinionForm({ doctor, onBack }: GetOpinionFormProps) {
  const navigate = useNavigate();
  const { user, patientProfile } = useSupabase();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [caseDetails, setCaseDetails] = useState<PatientCaseDetails>(() =>
    emptyPatientCaseDetails({ specialtyRequired: doctor.specialty })
  );
  const consultationTiers = getOfferedConsultationTiers(doctor);
  const [consultationDurationMinutes, setConsultationDurationMinutes] = useState<number>(
    consultationTiers[0]?.duration_minutes ?? STANDARD_CONSULTATION_DURATIONS[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [proceedWithoutRecords, setProceedWithoutRecords] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [redirectSecondsLeft, setRedirectSecondsLeft] = useState(
    MY_REQUESTS_REDIRECT_MS / 1000
  );

  useEffect(() => {
    if (!submitted) return;

    setRedirectSecondsLeft(MY_REQUESTS_REDIRECT_MS / 1000);
    const redirectTimer = window.setTimeout(() => {
      navigate(appScreenPath('my-requests'));
    }, MY_REQUESTS_REDIRECT_MS);

    const tickTimer = window.setInterval(() => {
      setRedirectSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(tickTimer);
    };
  }, [submitted, navigate]);

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

  useEffect(() => {
    let cancelled = false;
    void fetchDoctorSpecialties().then(({ data }) => {
      if (!cancelled) setSpecialties(data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

    const validationError = validatePatientCaseDetails(
      emptyPatientCaseDetails({
        ...caseDetails,
        specialtyRequired: doctor.specialty
      }),
      { requireConsent: true, submitOnly: true }
    );
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    if (records.length === 0 && !proceedWithoutRecords) {
      return;
    }

    const serialized = serializePatientCaseDetails({
      ...caseDetails,
      specialtyRequired: doctor.specialty
    });
    const message = '';

    setSubmitting(true);
    const patientName =
      patientProfile?.full_name ??
      (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) ??
      user?.email ??
      null;

    const { error } = await createOpinionRequest({
      doctorId: doctor.id,
      doctorName: doctor.full_name,
      message,
      recordIds: [...selectedIds],
      patientId: user?.id ?? null,
      patientName,
      consultationDurationMinutes,
      caseDetails: serialized
    });
    setSubmitting(false);

    if (error) {
      setSubmitError(
        `${error.message}. Run supabase/schema.sql (uploaded_files table) and npm run db:seed-records, then try again.`
      );
      return;
    }

    setSubmitted(true);
    clearPendingOpinionRequest();
  };

  const handleUploadRecords = () => {
    savePendingOpinionRequest({ flow: 'doctor-opinion', doctorId: doctor.id });
    navigate(appScreenPath('upload-records'));
  };

  const awaitingRecordsChoice =
    Boolean(user?.id) && !recordsLoading && !recordsError && records.length === 0 && !proceedWithoutRecords;

  if (submitted) {
    return (
      <section className='section-card opinion-form-card'>
        <div className='opinion-success'>
          <CheckCircle2 size={40} aria-hidden />
          <h3>Request submitted</h3>
          <p className='muted'>
            Your doctor consultation request was submitted. Your request will be assigned to our patient
            service team, who will coordinate with you and {doctor.full_name}.
          </p>
          <p className='muted'>
            Redirecting to My requests in {redirectSecondsLeft} second
            {redirectSecondsLeft === 1 ? '' : 's'}…
          </p>
          <button
            type='button'
            className='primary-btn wide'
            onClick={() => navigate(appScreenPath('my-requests'))}
          >
            Go to my requests now
          </button>
          <button type='button' className='secondary-btn wide' onClick={onBack}>
            Back to doctor profile
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className='section-card opinion-form-card' aria-labelledby='get-opinion-title'>
      <div className='section-head'>
        <h3 id='get-opinion-title'>Request doctor consultation</h3>
        <p>
          Send selected records and a message to <strong>{doctor.full_name}</strong> ({doctor.specialty})
        </p>
      </div>

      <form className='opinion-form' onSubmit={(e) => void handleSubmit(e)}>
        <fieldset className='opinion-fieldset'>
          <legend>Select medical records (optional)</legend>
          {records.length > 0 ? (
            <p className='muted opinion-fieldset-hint'>
              Share any records you would like the doctor to review, or continue without selecting any.
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
        <ConsultationDurationSelect
          tiers={consultationTiers}
          value={consultationDurationMinutes}
          onChange={setConsultationDurationMinutes}
          disabled={submitting}
          currency={normalizeConsultationCurrency(doctor.consultation_currency)}
          label='Choose consultation duration'
          hint={`Select how long you need with ${doctor.full_name}. The fee shown is what you will pay for that session.`}
        />

        <PatientCaseDetailsForm
          value={caseDetails}
          onChange={setCaseDetails}
          specialties={specialties}
          specialtyMode='from_doctor'
          doctorSpecialty={doctor.specialty}
          showCaseSections={false}
          showPreferences
          showConsent
          disabled={submitting}
        />

        {submitError ? (
          <p className='auth-error' role='alert'>
            {submitError}
          </p>
        ) : null}

        <button type='submit' className='primary-btn wide' disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
          </>
        ) : null}
      </form>
    </section>
  );
}
