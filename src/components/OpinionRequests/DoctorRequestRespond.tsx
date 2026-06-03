import { FileText } from 'lucide-react';
import {
  canDoctorGiveConsultation,
  isDoctorConsultationAwaitingCoordination
} from '../../lib/doctorConsultation';
import type { OpinionRequest } from '../../types/opinionRequest';
import DoctorGiveConsultationButton from './DoctorGiveConsultationButton';

type DoctorRequestRespondProps = {
  request: OpinionRequest;
  onNavigate?: (screenId: string) => void;
  returnScreen?: string;
};

export default function DoctorRequestRespond({
  request,
  onNavigate,
  returnScreen = 'case-review'
}: DoctorRequestRespondProps) {
  const hasResponse = Boolean(request.doctor_response?.trim());
  const showConsultationButton = canDoctorGiveConsultation(request);
  const awaitingCoordination = isDoctorConsultationAwaitingCoordination(request);

  return (
    <div className='doctor-request-respond'>
      {awaitingCoordination ? (
        <p className='muted doctor-respond-hint'>
          Our team is coordinating this case. You can draft your consultation now; it will be shared
          with the patient when ready.
        </p>
      ) : null}

      {hasResponse ? (
        <div className='doctor-response-block' role='region' aria-label='Your response to patient'>
          <h5>Your response</h5>
          <p>{request.doctor_response}</p>
          {request.responded_at ? (
            <span className='muted'>Sent {new Date(request.responded_at).toLocaleString()}</span>
          ) : null}
        </div>
      ) : null}

      {showConsultationButton ? (
        <DoctorGiveConsultationButton
          request={request}
          onNavigate={onNavigate}
          returnScreen={returnScreen}
        />
      ) : null}

      {request.records.length > 0 ? (
        <p className='muted doctor-respond-hint'>
          <FileText size={14} aria-hidden /> Review patient records below, then give your consultation.
        </p>
      ) : null}
    </div>
  );
}
