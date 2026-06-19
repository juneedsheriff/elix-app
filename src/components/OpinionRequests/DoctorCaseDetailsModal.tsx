import { useCallback, useEffect } from 'react';
import { ClipboardPlus, X } from 'lucide-react';
import { formatRequestDate } from '../../pages/admin/requests/requestsUtils';
import {
  canDoctorGiveConsultation,
  doctorConsultationButtonLabel
} from '../../lib/doctorConsultation';
import { openDoctorConsultation } from '../../lib/navigation/doctorConsultationNav';
import {
  fetchStaffOpinionRequestById,
  subscribeOpinionRequestLiveUpdates
} from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';
import DoctorPatientCaseDetailsSections from './DoctorPatientCaseDetailsSections';
import './doctor-case-details-modal.css';
import './doctor-patient-case-details-sections.css';

type DoctorCaseDetailsModalProps = {
  open: boolean;
  request: OpinionRequest | null;
  onClose: () => void;
  onRequestUpdated: (request: OpinionRequest) => void;
  onNavigate?: (screenId: string) => void;
  returnScreen?: string;
  onOpenError?: (message: string) => void;
};

function isLightboxOpen(): boolean {
  return Boolean(document.querySelector('.image-lightbox-modal-root'));
}

export default function DoctorCaseDetailsModal({
  open,
  request,
  onClose,
  onRequestUpdated,
  onNavigate,
  returnScreen = 'case-review',
  onOpenError
}: DoctorCaseDetailsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isLightboxOpen()) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !request) return;

    let cancelled = false;

    const refreshRequest = async () => {
      const { data } = await fetchStaffOpinionRequestById(request.id);
      if (!cancelled && data) {
        onRequestUpdated(data);
      }
    };

    return subscribeOpinionRequestLiveUpdates(request.id, () => {
      void refreshRequest();
    });
  }, [open, request?.id, onRequestUpdated]);

  const handleGiveConsultation = useCallback(() => {
    if (!request || !onNavigate) return;
    onClose();
    openDoctorConsultation(request.id, onNavigate, returnScreen, { openCaseContext: true });
  }, [onClose, onNavigate, request, returnScreen]);

  if (!open || !request) return null;

  const patientLabel = request.patient_name?.trim() || 'Patient';
  const showGiveConsultation = Boolean(onNavigate) && canDoctorGiveConsultation(request);

  return (
    <div className='elixhealth-modal-root doctor-case-details-modal-root' role='presentation'>
      <button
        type='button'
        className='elixhealth-modal-backdrop'
        onClick={onClose}
        aria-label='Close case details'
      />
      <div
        className='elixhealth-modal doctor-case-details-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='doctor-case-details-modal-title'
      >
        <div className='elixhealth-modal-head'>
          <div>
            <h2 id='doctor-case-details-modal-title'>Patient Case Details</h2>
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

        <div className='elixhealth-modal-body doctor-case-details-modal__body'>
          <DoctorPatientCaseDetailsSections
            request={request}
            onOpenError={onOpenError}
            lightboxModalZIndex={1000}
          />
        </div>

        <div className='elixhealth-modal-footer doctor-case-details-modal__footer'>
          <button type='button' className='secondary-btn' onClick={onClose}>
            Close
          </button>
          {showGiveConsultation ? (
            <button type='button' className='primary-btn' onClick={handleGiveConsultation}>
              <ClipboardPlus size={18} aria-hidden />
              {doctorConsultationButtonLabel(request)}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
