import OpinionRequestsPanel from '../OpinionRequests/OpinionRequestsPanel';
import type { ConsultationHours } from '../../types/doctor';

type DoctorIncomingRequestsProps = {
  doctorId: string | null | undefined;
  doctorEmail?: string | null;
  configured: boolean;
  onNavigate?: (screenId: string) => void;
  consultationHours?: ConsultationHours | null;
};

export default function DoctorIncomingRequests({
  doctorId,
  doctorEmail,
  configured,
  onNavigate,
  consultationHours
}: DoctorIncomingRequestsProps) {
  return (
    <OpinionRequestsPanel
      view='doctor'
      doctorId={doctorId}
      doctorEmail={doctorEmail}
      configured={configured}
      onNavigate={onNavigate}
      doctorReturnScreen='doctor-dashboard'
      doctorConsultationHours={consultationHours}
      title='Patient Requests'
      subtitle='All, pending, and completed requests assigned to you'
      signInHint='Sign in as a doctor to view patient requests.'
      emptyHint='No requests yet. Assigned pending and completed cases will appear here.'
    />
  );
}
