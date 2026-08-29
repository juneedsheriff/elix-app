import OpinionRequestsPanel from '../OpinionRequests/OpinionRequestsPanel';

type DoctorIncomingRequestsProps = {
  doctorId: string | null | undefined;
  doctorEmail?: string | null;
  configured: boolean;
  onNavigate?: (screenId: string) => void;
};

export default function DoctorIncomingRequests({
  doctorId,
  doctorEmail,
  configured,
  onNavigate
}: DoctorIncomingRequestsProps) {
  return (
    <OpinionRequestsPanel
      view='doctor'
      doctorId={doctorId}
      doctorEmail={doctorEmail}
      configured={configured}
      onNavigate={onNavigate}
      doctorReturnScreen='doctor-dashboard'
      title='Patient Requests'
      subtitle='Pending, assigned, and past requests for you'
      signInHint='Sign in as a doctor to view patient requests.'
      emptyHint='No assigned requests yet. Pending and past cases will appear here once patients are booked with you.'
    />
  );
}
