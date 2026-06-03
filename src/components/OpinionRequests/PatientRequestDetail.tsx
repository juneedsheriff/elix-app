import { ArrowLeft } from 'lucide-react';
import ConsultationPatientWorkflow from './ConsultationPatientWorkflow';
import { patientRequestStatusLabel } from '../../lib/opinionRequests';
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
  onUpdated: () => void;
  onOpenRecord: (storagePath: string | null) => void;
  onMessage: (message: string, type: 'error' | 'success') => void;
};

export default function PatientRequestDetail({
  request,
  liveTick,
  onBack,
  onUpdated,
  onOpenRecord,
  onMessage
}: PatientRequestDetailProps) {
  const statusText = patientRequestStatusLabel(request);

  return (
    <div className='patient-request-detail'>
      <button type='button' className='text-btn patient-request-back' onClick={onBack}>
        <ArrowLeft size={18} aria-hidden /> Back to requests
      </button>

      <div className='doctor-request-card patient-request-detail-card'>
        <div className='doctor-request-head'>
          <strong>{request.doctor_name ?? 'Doctor'}</strong>
          <div className='patient-request-detail-badges'>
            {request.records_verified_at ? (
              <span className='patient-docs-verified-badge patient-docs-verified-badge--inline'>
                Documents verified
              </span>
            ) : null}
            <span className={`tag status-${request.status}`}>{statusText}</span>
          </div>
        </div>

        {request.doctor_specialty ? (
          <p className='doctor-request-meta' style={{ marginTop: '0.35rem' }}>
            {request.doctor_specialty}
          </p>
        ) : null}

        <p className='doctor-request-meta patient-request-detail-meta'>
          <span>Submitted {formatRequestDate(request.created_at)}</span>
          <span className='patient-request-detail-meta__date'>
            {new Date(request.created_at).toLocaleString()}
          </span>
          {request.records.length ? (
            <span>
              {request.records.length} file{request.records.length === 1 ? '' : 's'} attached
            </span>
          ) : null}
        </p>

        <p className='doctor-request-message'>
          <strong>Your message:</strong> {request.message}
        </p>

        {/* {request.doctor_response ? (
          <div className='doctor-response-block patient-view' role='region' aria-label='Doctor response'>
            <h5>
              <Stethoscope size={16} aria-hidden /> Doctor&apos;s opinion
            </h5>
            <p>{request.doctor_response}</p>
            {request.responded_at ? (
              <span className='muted'>Received {formatRequestDate(request.responded_at)}</span>
            ) : null}
          </div>
        ) : null} */}

        <ConsultationPatientWorkflow
          request={request}
          liveTick={liveTick}
          onUpdated={onUpdated}
          onOpenRecord={(path) => {
            if (path) onOpenRecord(path);
          }}
          onMessage={onMessage}
        />

        
      </div>
    </div>
  );
}
