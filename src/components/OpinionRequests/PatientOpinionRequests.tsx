import OpinionRequestsPanel from './OpinionRequestsPanel';

type PatientOpinionRequestsProps = {
  patientAuthUserId: string | null | undefined;
  configured: boolean;
};

export default function PatientOpinionRequests({ patientAuthUserId, configured }: PatientOpinionRequestsProps) {
  return (
    <OpinionRequestsPanel
      view='patient'
      patientAuthUserId={patientAuthUserId}
      configured={configured}
      title='My opinion requests'
      subtitle='Track second opinion requests you sent to doctors'
      signInHint='Sign in as a patient to view your requests.'
      emptyHint='No requests yet. Browse doctors and tap Get opinion to send your first case.'
    />
  );
}
