import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  CONSULTATION_SUMMARY_FIELDS,
  consultationSummaryToFormValues,
  emptyConsultationSummaryValues,
  formatConsultationResponse,
  type ConsultationSummaryFormValues
} from '../../lib/consultationSummaryFields';
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

  const goBack = useCallback(() => {
    clearDoctorConsultationRequestId();
    onNavigate?.(returnScreen);
  }, [onNavigate, returnScreen]);

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

    if (!values.chief_complaint.trim() || !values.assessment_plan.trim()) {
      setError('Chief Complaint and Assessment & Plan are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      doctor_id: request.doctor_id,
      patient_auth_user_id: request.patient_id,
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
        <button
          type='button'
          className='secondary-btn doctor-consultation-page__back'
          onClick={goBack}
          disabled={submitting}
        >
          <ArrowLeft size={18} aria-hidden />
          Back
        </button>
        <div>
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
        <form className='doctor-consultation-page__form' onSubmit={(e) => void handleSubmit(e)}>
          {CONSULTATION_SUMMARY_FIELDS.map(({ key, label }) => (
            <label key={key} className='doctor-respond-label'>
              {label}
              <textarea
                className='doctor-respond-textarea'
                rows={key === 'prescription' || key === 'assessment_plan' ? 5 : 4}
                value={values[key]}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
                disabled={submitting}
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            </label>
          ))}

          <div className='doctor-respond-actions'>
            <button type='submit' className='primary-btn' disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} className='spin' aria-hidden /> Saving…
                </>
              ) : (
                'Submit consultation'
              )}
            </button>
            <button type='button' className='secondary-btn' disabled={submitting} onClick={goBack}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
