import { useCallback, useEffect, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Calendar, ClipboardList, FileText, Video } from 'lucide-react';
import {
  canDoctorGiveConsultation,
  hasPatientConsultationNotes
} from '../../lib/doctorConsultation';
import { formatRequestDate } from '../../pages/admin/requests/requestsUtils';
import type { OpinionRequest } from '../../types/opinionRequest';
import DoctorCaseDetailsModal from './DoctorCaseDetailsModal';
import DoctorConsultationNotesModal from './DoctorConsultationNotesModal';
import DoctorGiveConsultationButton from './DoctorGiveConsultationButton';

type DoctorIncomingRequestsMobileListProps = {
  data: OpinionRequest[];
  search: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNavigate?: (screenId: string) => void;
  returnScreen?: string;
  onOpenError?: (message: string) => void;
  onRequestUpdated: (request: OpinionRequest) => void;
};

function doctorStatusLabel(status: string): string {
  if (status === 'in_review') return 'In review';
  if (status === 'closed') return 'Closed';
  return 'Submitted';
}

export default function DoctorIncomingRequestsMobileList({
  data,
  search,
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
  onNavigate,
  returnScreen,
  onOpenError,
  onRequestUpdated
}: DoctorIncomingRequestsMobileListProps) {
  const [caseDetailsRequest, setCaseDetailsRequest] = useState<OpinionRequest | null>(null);
  const [consultationNotesRequest, setConsultationNotesRequest] = useState<OpinionRequest | null>(null);

  useEffect(() => {
    if (!caseDetailsRequest) return;
    const updated = data.find((request) => request.id === caseDetailsRequest.id);
    if (updated) setCaseDetailsRequest(updated);
  }, [data, caseDetailsRequest?.id]);

  useEffect(() => {
    if (!consultationNotesRequest) return;
    const updated = data.find((request) => request.id === consultationNotesRequest.id);
    if (updated) setConsultationNotesRequest(updated);
  }, [data, consultationNotesRequest?.id]);

  const handleCaseDetailsUpdated = useCallback(
    (updated: OpinionRequest) => {
      setCaseDetailsRequest(updated);
      onRequestUpdated(updated);
    },
    [onRequestUpdated]
  );

  const handleConsultationNotesUpdated = useCallback(
    (updated: OpinionRequest) => {
      setConsultationNotesRequest(updated);
      onRequestUpdated(updated);
    },
    [onRequestUpdated]
  );

  return (
    <>
      <div className='doctor-cases-mobile-toolbar'>
        <label className='doctor-cases-mobile-search'>
          <IconSearch size={18} stroke={1.5} aria-hidden />
          <input
            type='search'
            value={search}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder='Search cases…'
            aria-label='Search incoming requests'
          />
        </label>
        <p className='doctor-cases-mobile-count muted'>
          {data.length} case{data.length === 1 ? '' : 's'}
        </p>
      </div>

      {data.length === 0 ? (
        <div className='doctor-cases-mobile-empty'>
          <p className='muted'>
            {hasActiveFilters
              ? 'No cases match your search.'
              : 'No incoming requests yet. Patients can send cases from a doctor profile → Get opinion.'}
          </p>
          {hasActiveFilters ? (
            <button type='button' className='secondary-btn' onClick={onClearFilters}>
              Clear search
            </button>
          ) : null}
        </div>
      ) : (
        <ul className='doctor-request-list doctor-request-list--mobile-cards'>
          {data.map((request) => {
            const meetingLink = request.meeting_link?.trim();
            const showConsultation = canDoctorGiveConsultation(request);
            const hasNotes = hasPatientConsultationNotes(request);

            return (
              <li key={request.id} className='doctor-request-card doctor-incoming-mobile-card'>
                <div className='doctor-request-head'>
                  <strong>{request.patient_name ?? 'Patient'}</strong>
                  <span className={`tag status-${request.status}`}>{doctorStatusLabel(request.status)}</span>
                </div>

                {request.patient_email ? (
                  <p className='doctor-request-meta'>{request.patient_email}</p>
                ) : null}

                <p className='doctor-request-meta'>
                  Submitted {formatRequestDate(request.created_at)}
                </p>

                {request.message?.trim() ? (
                  <p className='doctor-request-message'>{request.message.trim()}</p>
                ) : null}

                {meetingLink ? (
                  <div className='doctor-incoming-mobile-card__meeting'>
                    <p className='doctor-incoming-mobile-card__meeting-label'>
                      <Video size={15} aria-hidden /> Video consultation
                    </p>
                    {request.scheduled_at ? (
                      <p className='doctor-request-meta'>
                        <Calendar size={14} aria-hidden />{' '}
                        {new Date(request.scheduled_at).toLocaleString()}
                      </p>
                    ) : null}
                    <a
                      href={meetingLink}
                      target='_blank'
                      rel='noreferrer'
                      className='text-btn doctor-incoming-mobile-card__join'
                    >
                      Join meeting
                    </a>
                  </div>
                ) : null}

                <div className='doctor-incoming-mobile-card__actions'>
                  <button
                    type='button'
                    className='secondary-btn doctor-incoming-mobile-card__btn'
                    onClick={() => setCaseDetailsRequest(request)}
                  >
                    <ClipboardList size={16} aria-hidden />
                    Case details
                  </button>

                  {hasNotes ? (
                    <button
                      type='button'
                      className='secondary-btn doctor-incoming-mobile-card__btn'
                      onClick={() => setConsultationNotesRequest(request)}
                    >
                      <FileText size={16} aria-hidden />
                      View notes
                    </button>
                  ) : null}

                  {showConsultation ? (
                    <DoctorGiveConsultationButton
                      request={request}
                      onNavigate={onNavigate}
                      returnScreen={returnScreen}
                    />
                  ) : request.doctor_response?.trim() ? (
                    <span className='tag status-closed'>Responded</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DoctorCaseDetailsModal
        open={Boolean(caseDetailsRequest)}
        request={caseDetailsRequest}
        onClose={() => setCaseDetailsRequest(null)}
        onOpenError={onOpenError}
        onNavigate={onNavigate}
        returnScreen={returnScreen}
        onRequestUpdated={handleCaseDetailsUpdated}
      />
      <DoctorConsultationNotesModal
        open={Boolean(consultationNotesRequest)}
        request={consultationNotesRequest}
        onClose={() => setConsultationNotesRequest(null)}
        onRequestUpdated={handleConsultationNotesUpdated}
      />
    </>
  );
}
