import DoctorIncomingRequests from '../../components/Doctors/DoctorIncomingRequests';
import type { ScreenPageProps } from '../types';

export default function CaseReviewPage({ doctorProfile, dbConnected, onNavigate }: ScreenPageProps) {
  return (
    <DoctorIncomingRequests
      doctorId={doctorProfile?.id}
      doctorEmail={doctorProfile?.email}
      configured={dbConnected}
      onNavigate={onNavigate}
    />
  );
}
