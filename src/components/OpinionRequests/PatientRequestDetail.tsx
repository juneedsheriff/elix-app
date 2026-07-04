import { ArrowLeft, Clock, FileText, MessageCircle, Stethoscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import ConsultationPatientWorkflow from './ConsultationPatientWorkflow';
import OpinionRequestAuditLink from './OpinionRequestAuditLink';
import RequestChatPanel from './RequestChatPanel';
import { isRecommendationOpinionRequest, patientRequestStatusLabel } from '../../lib/opinionRequests';
import type { SavedPatientCaseDetailsPatch } from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';

function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleString();
}

type PatientRequestDetailProps = {
  request: OpinionRequest;
  liveTick?: number;
  onBack: () => void;
  onOpenActivity: () => void;
  onUpdated: () => void;
  onRequestPatch?: (patch: SavedPatientCaseDetailsPatch) => void;
  patientAuthUserId?: string | null;
  onChatModeChange?: (active: boolean) => void;
  onOpenRecord: (storagePath: string | null) => void;
  onMessage: (message: string, type: 'error' | 'success') => void;
};

export default function PatientRequestDetail({
  request,
  liveTick,
  onBack,
  onOpenActivity,
  onUpdated,
  onRequestPatch,
  patientAuthUserId,
  onChatModeChange,
  onOpenRecord,
  onMessage
}: PatientRequestDetailProps) {
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    setShowChat(false);
  }, [request.id]);

  useEffect(() => {
    onChatModeChange?.(showChat);
    return () => onChatModeChange?.(false);
  }, [onChatModeChange, showChat]);

  const statusText = patientRequestStatusLabel(request);
  const awaitingRecommendation = isRecommendationOpinionRequest(request) && !request.doctor_name;
  const headline = awaitingRecommendation ? 'Doctor recommendations' : (request.doctor_name ?? 'Doctor');

  return (
    <div className={`patient-request-detail${showChat ? ' patient-request-detail--chat' : ''}`}>
      {!showChat ? (
        <button type='button' className='text-btn patient-request-back' onClick={onBack}>
          <ArrowLeft size={18} aria-hidden /> Back to requests
        </button>
      ) : null}

      <div
        className={`doctor-request-card patient-request-detail-card${
          showChat ? ' patient-request-detail-card--chat' : ''
        }`}
      >
        {showChat ? (
          <section className='patient-request-chat-view' id={`request-chat-panel-${request.id}`}>
            <button
              type='button'
              className='text-btn patient-request-chat-view__back'
              onClick={() => setShowChat(false)}
            >
              <ArrowLeft size={16} aria-hidden /> Back to request
            </button>
            <RequestChatPanel
              request={request}
              viewerRole='patient'
              disabled={request.status === 'closed' || !patientAuthUserId}
              disabledReason={
                request.status === 'closed'
                  ? 'This request is closed. Chat is read-only.'
                  : !patientAuthUserId
                    ? 'Sign in as patient to send messages.'
                    : null
              }
              onError={(message) => onMessage(message, 'error')}
            />
          </section>
        ) : (
          <>
            <div className='doctor-request-head'>
              <strong>{headline}</strong>
              <div className='patient-request-detail-badges'>
                <div className='patient-request-detail-badges__status'>
                  {request.records_verified_at ? (
                    <span className='patient-docs-verified-badge patient-docs-verified-badge--inline'>
                      Documents verified
                    </span>
                  ) : null}
                  <span className={`tag status-${request.status}`}>{statusText}</span>
                </div>
                <OpinionRequestAuditLink onOpen={onOpenActivity} />
              </div>
            </div>

            <section className='patient-request-detail-summary' aria-label='Request summary'>
              {awaitingRecommendation ? (
                <div className='patient-request-detail-summary__notice'>
                  {request.requested_specialty ? (
                    <div className='patient-request-detail-summary__row'>
                      <span className='patient-request-detail-summary__icon' aria-hidden>
                        <Stethoscope size={18} />
                      </span>
                      <div className='patient-request-detail-summary__content'>
                        <span className='patient-request-detail-summary__label'>Requested specialty</span>
                        <p className='patient-request-detail-summary__value'>{request.requested_specialty}</p>
                      </div>
                    </div>
                  ) : null}
                  <p className='patient-request-detail-summary__hint'>
                    Our care team will review your case and recommend suitable specialists.
                  </p>
                </div>
              ) : request.doctor_specialty ? (
                <div className='patient-request-detail-summary__row patient-request-detail-summary__row--solo'>
                  <span className='patient-request-detail-summary__icon' aria-hidden>
                    <Stethoscope size={18} />
                  </span>
                  <div className='patient-request-detail-summary__content'>
                    <span className='patient-request-detail-summary__label'>Specialty</span>
                    <p className='patient-request-detail-summary__value'>{request.doctor_specialty}</p>
                  </div>
                </div>
              ) : null}

              <ul className='patient-request-detail-summary__facts'>
                <li className='patient-request-detail-summary__row'>
                  <span className='patient-request-detail-summary__icon' aria-hidden>
                    <Clock size={18} />
                  </span>
                  <div className='patient-request-detail-summary__content'>
                    <span className='patient-request-detail-summary__label'>Submitted</span>
                    <p className='patient-request-detail-summary__value'>
                      {formatRequestDate(request.created_at)}
                      <span className='patient-request-detail-summary__value-sub'>
                        {new Date(request.created_at).toLocaleString()}
                      </span>
                    </p>
                  </div>
                </li>
                {request.records.length > 0 ? (
                  <li className='patient-request-detail-summary__row'>
                    <span className='patient-request-detail-summary__icon' aria-hidden>
                      <FileText size={18} />
                    </span>
                    <div className='patient-request-detail-summary__content'>
                      <span className='patient-request-detail-summary__label'>Attachments</span>
                      <p className='patient-request-detail-summary__value'>
                        {request.records.length} file{request.records.length === 1 ? '' : 's'} attached
                      </p>
                    </div>
                  </li>
                ) : null}
              </ul>
            </section>

            <ConsultationPatientWorkflow
              request={request}
              liveTick={liveTick}
              onUpdated={onUpdated}
              onRequestPatch={onRequestPatch}
              onOpenRecord={(path) => {
                if (path) onOpenRecord(path);
              }}
              onMessage={onMessage}
            />

            <div className='patient-request-chat-dock' role='presentation'>
              <button
                type='button'
                className='patient-request-chat-fab'
                onClick={() => setShowChat(true)}
                aria-label='Chat with PSE'
              >
                <MessageCircle size={18} aria-hidden />
                <span>Chat with PSE</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
