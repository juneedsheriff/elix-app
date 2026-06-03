import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, Eraser } from 'lucide-react';
import VoiceDictationButton from '../../components/Consultation/VoiceDictationButton';
import MicrophonePermissionModal from '../../components/Consultation/MicrophonePermissionModal';
import {
  CONSULTATION_SUMMARY_FIELDS,
  consultationSummaryToFormValues,
  emptyConsultationSummaryValues,
  formatConsultationResponse,
  type ConsultationSummaryFormValues
} from '../../lib/consultationSummaryFields';
import { mergeDictatedFieldText } from '../../lib/speech/formatDictatedClinicalText';
import { previewDictationText } from '../../lib/speech/previewDictationText';
import { useConsultationVoiceDictation } from '../../lib/speech/useConsultationVoiceDictation';
import { useMicrophonePermissionGate } from '../../lib/speech/useMicrophonePermissionGate';
import { consumeReturnScreen } from '../../lib/navigation/appRoutes';
import {
  clearDoctorConsultationRequestId,
  getDoctorConsultationRequestId
} from '../../lib/navigation/doctorConsultationNav';
import {
  fetchConsultationSummary,
  fetchDoctorOpinionRequests,
  saveDoctorConsultation
} from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';
import type { ScreenPageProps } from '../types';

export default function DoctorConsultationPage({ dbConnected, onNavigate }: ScreenPageProps) {
  const [request, setRequest] = useState<OpinionRequest | null>(null);
  const [values, setValues] = useState<ConsultationSummaryFormValues>(emptyConsultationSummaryValues);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [returnScreen] = useState(() => consumeReturnScreen() ?? 'case-review');

  const handleDictated = useCallback((fieldKey: keyof ConsultationSummaryFormValues, rawTranscript: string) => {
    setValues((prev) => ({
      ...prev,
      [fieldKey]: mergeDictatedFieldText(prev[fieldKey], rawTranscript, fieldKey)
    }));
  }, []);

  const {
    supported: voiceSupported,
    activeField: voiceField,
    sessionText: voiceSessionText,
    interimText: voiceInterimText,
    error: voiceError,
    start: startVoice,
    stop: stopVoice
  } = useConsultationVoiceDictation({ onDictated: handleDictated });

  const consultationReady = !loading && Boolean(request);
  const {
    status: micStatus,
    requesting: micRequesting,
    gateActive: micGateActive,
    micGranted,
    requestAccess: requestMicAccess,
    skip: skipMicGate
  } = useMicrophonePermissionGate(consultationReady && voiceSupported);

  const voiceEnabled = voiceSupported && micGranted;

  const handleClearField = useCallback(
    (fieldKey: keyof ConsultationSummaryFormValues) => {
      if (voiceField === fieldKey) {
        stopVoice({ discard: true });
      }
      setValues((prev) => ({ ...prev, [fieldKey]: '' }));
    },
    [stopVoice, voiceField]
  );

  const goBack = useCallback(() => {
    stopVoice();
    clearDoctorConsultationRequestId();
    onNavigate?.(returnScreen);
  }, [onNavigate, returnScreen, stopVoice]);

  const load = useCallback(async () => {
    const requestId = getDoctorConsultationRequestId();
    if (!requestId || !dbConnected) {
      setRequest(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [requestsRes, summaryRes] = await Promise.all([
      fetchDoctorOpinionRequests(),
      fetchConsultationSummary(requestId)
    ]);

    if (requestsRes.error) {
      setError(requestsRes.error.message);
      setRequest(null);
      setLoading(false);
      return;
    }

    const match = (requestsRes.data ?? []).find((row) => row.id === requestId) ?? null;
    if (!match) {
      setError('This request is no longer available.');
      setRequest(null);
      setLoading(false);
      return;
    }

    setRequest(match);

    const fromSummary = consultationSummaryToFormValues(summaryRes.data);
    const hasSummary = Object.values(fromSummary).some(Boolean);
    if (hasSummary) {
      setValues(fromSummary);
    } else if (match.doctor_response?.trim()) {
      setValues({ ...emptyConsultationSummaryValues(), assessment_plan: match.doctor_response.trim() });
    } else {
      setValues(emptyConsultationSummaryValues());
    }

    setLoading(false);
  }, [dbConnected]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!request) return;

    stopVoice();

    if (!values.chief_complaint.trim() || !values.assessment_plan.trim()) {
      setError('Chief Complaint and Assessment & Plan are required.');
      return;
    }

    const doctorId = request.doctor_id;
    const patientId = request.patient_id;
    if (!doctorId || !patientId) {
      setError('This request is missing doctor or patient information.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      doctor_id: doctorId,
      patient_auth_user_id: patientId,
      chief_complaint: values.chief_complaint.trim(),
      history_present_illness: values.history_present_illness.trim() || null,
      vital_signs: values.vital_signs.trim() || null,
      current_medications: values.current_medications.trim() || null,
      labs_diagnostics: values.labs_diagnostics.trim() || null,
      assessment_plan: values.assessment_plan.trim(),
      prescription: values.prescription.trim() || null
    };

    const { error: submitError } = await saveDoctorConsultation(
      request.id,
      request,
      payload,
      formatConsultationResponse(values)
    );
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    clearDoctorConsultationRequestId();
    onNavigate?.(returnScreen);
  };

  if (!getDoctorConsultationRequestId()) {
    return (
      <div className='doctor-consultation-page'>
        <button type='button' className='secondary-btn doctor-consultation-page__back' onClick={goBack}>
          <ArrowLeft size={18} aria-hidden />
          Back to requests
        </button>
        <p className='muted'>No consultation selected. Open a request from your case queue.</p>
      </div>
    );
  }

  return (
    <div className='doctor-consultation-page'>
      <header className='doctor-consultation-page__header'>
       
        <div className='doctor-consultation-page__heading'>
        <button
          type='button'
          className='secondary-btn doctor-consultation-page__back'
          onClick={goBack}
          disabled={submitting}
        >
          <ArrowLeft size={18} aria-hidden />
       
        </button>
          <h2 className='doctor-consultation-page__title'>Consultation</h2>
          {request ? (
            <p className='doctor-consultation-page__subtitle muted'>
              {request.patient_name ?? 'Patient'}
              {request.patient_email ? ` · ${request.patient_email}` : ''}
            </p>
          ) : null}
        </div>
      </header>

      {loading ? (
        <p className='doctor-status'>
          <Loader2 size={18} className='spin' aria-hidden /> Loading consultation…
        </p>
      ) : null}

      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      {!loading && request ? (
        <>
          {micGateActive ? (
            <MicrophonePermissionModal
              status={micStatus}
              requesting={micRequesting}
              onAllow={requestMicAccess}
              onContinueWithoutVoice={skipMicGate}
            />
          ) : null}

          <form
            id='doctor-consultation-form'
            className='doctor-consultation-page__form'
            onSubmit={(e) => void handleSubmit(e)}
          >
            <div
              className={`doctor-consultation-page__fields ${micGateActive ? 'doctor-consultation-page__fields--locked' : ''}`}
              aria-hidden={micGateActive}
            >
          {voiceEnabled ? (
            <p className='doctor-respond-voice-tip muted'>
              Tap Voice on any field to dictate. Say &ldquo;new line&rdquo;, &ldquo;comma&rdquo;, or &ldquo;period&rdquo; for
              formatting; lists are structured automatically for meds and prescriptions.
            </p>
          ) : null}

          {CONSULTATION_SUMMARY_FIELDS.map(({ key, label }) => {
            const isRecording = voiceField === key;
            const displayValue = isRecording
              ? previewDictationText(values[key], voiceSessionText, voiceInterimText)
              : values[key];
            const fieldHasContent =
              Boolean(values[key].trim()) ||
              (isRecording && Boolean(voiceSessionText.trim() || voiceInterimText.trim()));

            return (
              <label key={key} className='doctor-respond-label'>
                <span className='doctor-respond-label__head'>
                  <span>{label}</span>
                  <span className='doctor-respond-label__actions'>
                    <button
                      type='button'
                      className='doctor-consultation-clear-btn'
                      onClick={() => handleClearField(key)}
                      disabled={submitting || micGateActive || !fieldHasContent}
                      aria-label={`Clear ${label}`}
                      title={`Clear ${label}`}
                    >
                      <Eraser size={14} aria-hidden />
                      <span>Clear</span>
                    </button>
                    <VoiceDictationButton
                      active={isRecording}
                      supported={voiceEnabled}
                      disabled={submitting || micGateActive}
                      label={label}
                      onClick={() => startVoice(key)}
                    />
                  </span>
                </span>
                <textarea
                  className={`doctor-respond-textarea ${isRecording ? 'doctor-respond-textarea--recording' : ''}`}
                  rows={key === 'prescription' || key === 'assessment_plan' ? 5 : 4}
                  value={displayValue}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                  disabled={submitting || isRecording}
                  placeholder={`Enter ${label.toLowerCase()}…`}
                />
                {isRecording ? (
                  <span className='doctor-respond-voice-status' role='status'>
                    Listening… tap Stop when finished
                  </span>
                ) : null}
              </label>
            );
          })}

          {voiceError ? (
            <p className='auth-error' role='alert'>
              {voiceError}
            </p>
          ) : null}
            </div>

            <footer className='screen-form-footer screen-form-footer--inset'>
              <div className='screen-form-footer-actions'>
             
                <button
                  type='button'
                  className='secondary-btn screen-form-btn'
                  disabled={submitting}
                  onClick={goBack}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  className='primary-btn screen-form-btn'
                  disabled={submitting || micGateActive}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className='spin' aria-hidden /> Saving…
                    </>
                  ) : (
                    'Submit' 
                  )}
                </button>
              </div>
            </footer>
        </form>
        </>
      ) : null}
    </div>
  );
}
