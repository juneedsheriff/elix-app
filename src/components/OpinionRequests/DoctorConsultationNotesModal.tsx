import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import ConsultationSummaryPdfView from '../ConsultationWorkflow/ConsultationSummaryPdfView';
import { hasConsultationSummary } from '../../lib/consultationWizard';
import { hasPatientConsultationNotes } from '../../lib/doctorConsultation';
import {
  fetchConsultationSummary,
  fetchStaffOpinionRequestById,
  subscribeOpinionRequestLiveUpdates
} from '../../lib/opinionRequests';
import { formatRequestDate } from '../../pages/admin/requests/requestsUtils';
import type { ConsultationSummary, OpinionRequest } from '../../types/opinionRequest';
import './doctor-consultation-notes-modal.css';

type DoctorConsultationNotesModalProps = {
  open: boolean;
  request: OpinionRequest | null;
  onClose: () => void;
  onRequestUpdated: (request: OpinionRequest) => void;
};

export default function DoctorConsultationNotesModal({
  open,
  request,
  onClose,
  onRequestUpdated
}: DoctorConsultationNotesModalProps) {
  const [summary, setSummary] = useState<ConsultationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !request) {
      setSummary(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadSummary = async () => {
      if (hasConsultationSummary(request.consultation_summary)) {
        setSummary(request.consultation_summary ?? null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await fetchConsultationSummary(request.id);
      if (!cancelled) {
        setSummary(data);
        setLoading(false);
      }
    };

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [open, request?.id, request?.consultation_summary]);

  useEffect(() => {
    if (!open || !request) return;

    let cancelled = false;

    const refresh = async () => {
      const [requestRes, summaryRes] = await Promise.all([
        fetchStaffOpinionRequestById(request.id),
        fetchConsultationSummary(request.id)
      ]);
      if (cancelled) return;
      if (requestRes.data) onRequestUpdated(requestRes.data);
      if (summaryRes.data) setSummary(summaryRes.data);
    };

    return subscribeOpinionRequestLiveUpdates(request.id, () => {
      void refresh();
    });
  }, [open, onRequestUpdated, request?.id]);

  if (!open || !request) return null;

  const patientLabel = request.patient_name?.trim() || 'Patient';
  const hasNotes = hasPatientConsultationNotes(request) || hasConsultationSummary(summary);

  return (
    <div className='elixhealth-modal-root doctor-consultation-notes-modal-root' role='presentation'>
      <button
        type='button'
        className='elixhealth-modal-backdrop'
        onClick={onClose}
        aria-label='Close consultation notes'
      />
      <div
        className='elixhealth-modal doctor-consultation-notes-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='doctor-consultation-notes-modal-title'
      >
        <div className='elixhealth-modal-head'>
          <div>
            <h2 id='doctor-consultation-notes-modal-title'>Consultation notes</h2>
            <p className='muted'>
              {patientLabel}
              {request.patient_email ? ` · ${request.patient_email}` : ''}
              {' · '}
              Submitted {formatRequestDate(request.created_at)}
            </p>
          </div>
          <button
            type='button'
            className='icon-btn elixhealth-modal-close'
            onClick={onClose}
            aria-label='Close'
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className='elixhealth-modal-body doctor-consultation-notes-modal__body'>
          {loading ? (
            <p className='doctor-status'>
              <Loader2 size={18} className='spin' aria-hidden /> Loading consultation notes…
            </p>
          ) : null}

          {!loading && summary && hasConsultationSummary(summary) ? (
            <ConsultationSummaryPdfView summary={summary} request={request} />
          ) : null}

          {!loading && !hasConsultationSummary(summary) && request.doctor_response?.trim() ? (
            <div className='doctor-consultation-notes-modal__legacy'>
              <p className='doctor-consultation-notes-modal__legacy-text'>{request.doctor_response}</p>
            </div>
          ) : null}

          {!loading && !hasNotes ? (
            <p className='muted'>No consultation notes submitted yet.</p>
          ) : null}
        </div>

        <div className='elixhealth-modal-footer'>
          <button type='button' className='secondary-btn' onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
