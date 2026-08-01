import OpinionRequestsPanel from '../../components/OpinionRequests/OpinionRequestsPanel';
import type { ScreenPageProps } from '../types';

export default function DoctorHomeCarePage({ doctorProfile, dbConnected, onNavigate }: ScreenPageProps) {
  return (
    <OpinionRequestsPanel
      view='doctor'
      doctorId={doctorProfile?.id}
      doctorEmail={doctorProfile?.email}
      configured={dbConnected}
      onNavigate={onNavigate}
      doctorReturnScreen='doctor-homecare'
      requestKind='homecare'
      title='Home care requests'
      subtitle='Home care service requests assigned to you — kept separate from doctor consultations'
      signInHint='Sign in as a doctor to view home care requests.'
      emptyHint='No home care requests assigned to you yet. Clinic PSE will route home care cases here when you are assigned.'
    />
  );
}
