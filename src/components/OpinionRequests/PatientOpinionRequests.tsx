import PatientMyRequests from './PatientMyRequests';

type PatientOpinionRequestsProps = {
  patientAuthUserId: string | null | undefined;
  configured: boolean;
  onNavigate?: (screenId: string) => void;
};

export default function PatientOpinionRequests({
  patientAuthUserId,
  configured,
  onNavigate
}: PatientOpinionRequestsProps) {
  return (
    <PatientMyRequests
      patientAuthUserId={patientAuthUserId}
      configured={configured}
      onNavigate={onNavigate}
    />
  );
}
