import PatientMyRequests from './PatientMyRequests';

type PatientOpinionRequestsProps = {
  patientAuthUserId: string | null | undefined;
  configured: boolean;
};

export default function PatientOpinionRequests({ patientAuthUserId, configured }: PatientOpinionRequestsProps) {
  return <PatientMyRequests patientAuthUserId={patientAuthUserId} configured={configured} />;
}
