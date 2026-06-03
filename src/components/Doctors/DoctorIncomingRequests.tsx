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
      doctorReturnScreen='case-review'
      title='Incoming requests'
      subtitle='Second opinion requests from patients assigned to you'
      signInHint='Sign in as a doctor to view incoming requests.'
      emptyHint='No requests yet. Patients can send cases from a doctor profile → Get opinion.'
    />
  );
}
