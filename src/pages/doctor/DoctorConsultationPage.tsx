import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ClipboardList, FileUp, Loader2, Eraser } from 'lucide-react';
import VoiceDictationButton from '../../components/Consultation/VoiceDictationButton';
import MicrophonePermissionModal from '../../components/Consultation/MicrophonePermissionModal';
import ConsultationSummaryPdfView from '../../components/ConsultationWorkflow/ConsultationSummaryPdfView';
import DoctorCaseDetailsModal from '../../components/OpinionRequests/DoctorCaseDetailsModal';
import DoctorPatientCaseDetailsSections from '../../components/OpinionRequests/DoctorPatientCaseDetailsSections';
import '../../components/OpinionRequests/doctor-patient-case-details-sections.css';
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
  consumeDoctorConsultationOpenCaseContext,
  getDoctorConsultationRequestId
} from '../../lib/navigation/doctorConsultationNav';
import {
  consultationNotesPdfValidationError,
  fetchConsultationSummary,
  fetchDoctorOpinionRequests,
  fetchStaffOpinionRequestById,
  saveDoctorConsultation,
  saveDoctorConsultationUpload,
  subscribeOpinionRequestLiveUpdates
} from '../../lib/opinionRequests';
import { hasConsultationSummary } from '../../lib/consultationWizard';
import type { ConsultationSummary, OpinionRequest } from '../../types/opinionRequest';
import type { ScreenPageProps } from '../types';

type ConsultationMode = 'fill' | 'upload';

export default function DoctorConsultationPage({
  dbConnected,
  doctorProfile,
  onNavigate
}: ScreenPageProps) {
  const [request, setRequest] = useState<OpinionRequest | null>(null);
  const [summary, setSummary] = useState<ConsultationSummary | null>(null);
  const [values, setValues] = useState<ConsultationSummaryFormValues>(emptyConsultationSummaryValues);
  const [mode, setMode] = useState<ConsultationMode>('fill');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const consultationRequestIdRef = useRef(getDoctorConsultationRequestId());

  const [returnScreen] = useState(() => consumeReturnScreen() ?? 'case-review');
  const [caseContextOpen, setCaseContextOpen] = useState(() => {
    if (!consumeDoctorConsultationOpenCaseContext()) return false;
    return typeof document !== 'undefined' && Boolean(document.querySelector('.mobile-shell'));
  });

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

  const consultationReady = !loading && Boolean(request) && mode === 'fill';
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
    onNavigate?.(returnScreen);
    clearDoctorConsultationRequestId();
    consultationRequestIdRef.current = null;
  }, [onNavigate, returnScreen, stopVoice]);

  const goToCasesAfterSubmit = useCallback(() => {
    stopVoice();
    onNavigate?.('case-review');
    clearDoctorConsultationRequestId();
    consultationRequestIdRef.current = null;
  }, [onNavigate, stopVoice]);

  const switchMode = useCallback(
    (nextMode: ConsultationMode) => {
      if (nextMode === 'upload') {
        stopVoice();
      }
      setMode(nextMode);
      setError(null);
      setSuccessMessage(null);
    },
    [stopVoice]
  );

  const load = useCallback(async () => {
    const requestId = consultationRequestIdRef.current;
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
    setSummary(summaryRes.data ?? null);

    const fromSummary = consultationSummaryToFormValues(summaryRes.data);
    const hasSummary = Object.values(fromSummary).some(Boolean);
    if (hasSummary) {
      setValues(fromSummary);
    } else if (match.doctor_response?.trim()) {
      setValues({ ...emptyConsultationSummaryValues(), assessment_plan: match.doctor_response.trim() });
    } else {
      setValues(emptyConsultationSummaryValues());
    }

    if (summaryRes.data?.pdf_storage_path && !hasSummary) {
      setMode('upload');
    }

    setLoading(false);
  }, [dbConnected]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!request?.id) return;

    let cancelled = false;

    const refreshRequest = async () => {
      const { data } = await fetchStaffOpinionRequestById(request.id);
      if (!cancelled && data) {
        setRequest(data);
      }
    };

    return subscribeOpinionRequestLiveUpdates(request.id, () => {
      void refreshRequest();
    });
  }, [request?.id]);

  useEffect(() => {
    document.body.classList.toggle('doctor-consultation-mic-gate-open', micGateActive);
    return () => document.body.classList.remove('doctor-consultation-mic-gate-open');
  }, [micGateActive]);

  const handleFillSubmit = async (event: FormEvent) => {
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
      formatConsultationResponse(values),
      doctorProfile
    );
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    goToCasesAfterSubmit();
  };

  const handleUploadSubmit = async () => {
    if (!request) return;

    if (!uploadFile) {
      setError('Select a PDF file to upload.');
      return;
    }

    const validationError = consultationNotesPdfValidationError(uploadFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: submitError } = await saveDoctorConsultationUpload(
      request.id,
      request,
      uploadFile,
      uploadNote,
      doctorProfile
    );
    setSubmitting(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    goToCasesAfterSubmit();
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setUploadFile(null);
      return;
    }
    const validationError = consultationNotesPdfValidationError(file);
    if (validationError) {
      setError(validationError);
      setUploadFile(null);
      return;
    }
    setError(null);
    setUploadFile(file);
  };

  if (!consultationRequestIdRef.current) {
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
            aria-label='Back to requests'
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
          <div className='doctor-consultation-page__heading-titles'>
            <h2 className='doctor-consultation-page__title'>Consultation</h2>
            {request ? (
              <p className='doctor-consultation-page__subtitle muted'>
                <span className='doctor-consultation-page__patient-name'>
                  {request.patient_name ?? 'Patient'}
                </span>
            
              </p>
            ) : null}
          </div>
        </div>
        <div className='doctor-consultation-page__case-context-action'>
          <button
            type='button'
            className='secondary-btn doctor-consultation-page__case-context-btn'
            onClick={() => setCaseContextOpen(true)}
            disabled={loading || !request}
            aria-haspopup='dialog'
            aria-expanded={caseContextOpen}
            aria-describedby='doctor-consultation-case-context-hint'
          >
            <ClipboardList size={18} aria-hidden />
            Patient case details
          </button>
          <p id='doctor-consultation-case-context-hint' className='doctor-consultation-page__case-context-hint muted'>
            Click to view case details
          </p>
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

      {successMessage ? (
        <p className='doctor-consultation-page__success' role='status'>
          {successMessage}
        </p>
      ) : null}

      {!loading && request ? (
        <div className='doctor-consultation-page__workspace'>
          <aside className='doctor-consultation-page__case-context' aria-label='Patient case details'>
            <h3 className='doctor-consultation-page__case-context-title'>Patient case details</h3>
            <DoctorPatientCaseDetailsSections
              request={request}
              onOpenError={setError}
              lightboxModalZIndex={500}
            />
          </aside>

          <div className='doctor-consultation-page__main'>
          {hasConsultationSummary(summary) && summary ? (
            <ConsultationSummaryPdfView summary={summary} request={request} />
          ) : null}

          <div className='doctor-consultation-page__tabs' role='tablist' aria-label='Consultation notes mode'>
            <button
              type='button'
              role='tab'
              aria-selected={mode === 'fill'}
              className={`doctor-consultation-page__tab${mode === 'fill' ? ' doctor-consultation-page__tab--active' : ''}`}
              onClick={() => switchMode('fill')}
              disabled={submitting}
            >
              Fill notes
            </button>
            <button
              type='button'
              role='tab'
              aria-selected={mode === 'upload'}
              className={`doctor-consultation-page__tab${mode === 'upload' ? ' doctor-consultation-page__tab--active' : ''}`}
              onClick={() => switchMode('upload')}
              disabled={submitting}
            >
              Upload PDF
            </button>
          </div>

          {mode === 'fill' ? (
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
                onSubmit={(e) => void handleFillSubmit(e)}
              >
                <p className='muted doctor-consultation-page__mode-hint'>
                  Complete the fields below. A branded consultation notes PDF with Elix logo and your
                  clinic details will be generated on submit.
                </p>

                <div
                  className={`doctor-consultation-page__fields ${micGateActive ? 'doctor-consultation-page__fields--locked' : ''}`}
                  aria-hidden={micGateActive}
                >
                  {voiceEnabled ? (
                    <p className='doctor-respond-voice-tip muted'>
                      Tap Voice on any field to dictate. Say &ldquo;new line&rdquo;, &ldquo;comma&rdquo;, or
                      &ldquo;period&rdquo; for formatting; lists are structured automatically for meds and
                      prescriptions.
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
          ) : (
            <div className='doctor-consultation-page__form'>
              <p className='muted doctor-consultation-page__mode-hint'>
                Upload an existing consultation notes PDF (max 10 MB). You can add an optional note for
                the patient record.
              </p>

              <div className='doctor-consultation-page__upload'>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='application/pdf,.pdf'
                  className='doctor-consultation-page__file-input'
                  onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  disabled={submitting}
                />
                <button
                  type='button'
                  className='secondary-btn doctor-consultation-page__upload-btn'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  <FileUp size={18} aria-hidden />
                  {uploadFile ? 'Change PDF' : 'Choose PDF'}
                </button>
                {uploadFile ? (
                  <p className='doctor-consultation-page__file-name'>{uploadFile.name}</p>
                ) : (
                  <p className='muted doctor-consultation-page__file-hint'>No file selected</p>
                )}
              </div>

              <label className='doctor-respond-label'>
                <span>Optional note</span>
                <textarea
                  className='doctor-respond-textarea'
                  rows={3}
                  value={uploadNote}
                  onChange={(event) => setUploadNote(event.target.value)}
                  disabled={submitting}
                  placeholder='Brief note to include with the uploaded notes…'
                />
              </label>

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
                    type='button'
                    className='primary-btn screen-form-btn'
                    disabled={submitting || !uploadFile}
                    onClick={() => void handleUploadSubmit()}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className='spin' aria-hidden /> Uploading…
                      </>
                    ) : (
                      'Submit'
                    )}
                  </button>
                </div>
              </footer>
            </div>
          )}
          </div>
        </div>
      ) : null}

      {request ? (
        <DoctorCaseDetailsModal
          open={caseContextOpen}
          request={request}
          onClose={() => setCaseContextOpen(false)}
          onRequestUpdated={setRequest}
          onOpenError={setError}
        />
      ) : null}
    </div>
  );
}
