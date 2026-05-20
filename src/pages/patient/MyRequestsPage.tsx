import PatientOpinionRequests from '../../components/OpinionRequests/PatientOpinionRequests';
import type { ScreenPageProps } from '../types';

export default function MyRequestsPage({ userId, dbConnected }: ScreenPageProps) {
  return <PatientOpinionRequests patientAuthUserId={userId ?? null} configured={dbConnected} />;
}
