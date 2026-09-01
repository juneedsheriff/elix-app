import DoctorIncomingRequests from '../../components/Doctors/DoctorIncomingRequests';
import {
  avatarColorFromName,
  displayInitials,
  resolveProfilePhotoUrl
} from '../../lib/avatarDisplay';
import { formatDoctorWelcomeName } from '../../lib/doctors';
import type { ScreenPageProps } from '../types';

type DoctorDashboardPageProps = ScreenPageProps & {
  onNavigate?: (screenId: string) => void;
};

export default function DoctorDashboardPage({
  doctorProfile,
  dbConnected,
  onNavigate
}: DoctorDashboardPageProps) {
  const welcomeName = formatDoctorWelcomeName(doctorProfile?.full_name);
  const photoUrl = resolveProfilePhotoUrl(doctorProfile?.image_url);
  const initials = displayInitials(doctorProfile?.full_name);
  const avatarBg = avatarColorFromName(doctorProfile?.full_name);

  return (
    <div className='screen-grid doctor-dashboard-page elixhealth-doctor-dashboard'>
      <header className='doctor-dashboard-welcome' aria-label='Welcome'>
        <div className='doctor-dashboard-welcome__avatar' aria-hidden>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=''
              className='doctor-dashboard-welcome__photo'
              width={72}
              height={72}
            />
          ) : (
            <span className='doctor-dashboard-welcome__initials' style={{ background: avatarBg }}>
              {initials}
            </span>
          )}
        </div>
        <div className='doctor-dashboard-welcome__text'>
          <h1 className='doctor-dashboard-welcome__title'>Welcome, {welcomeName}!</h1>
          {doctorProfile?.specialty ? (
            <p className='doctor-dashboard-welcome__subtitle muted'>{doctorProfile.specialty}</p>
          ) : null}
        </div>
      </header>

      <DoctorIncomingRequests
        doctorId={doctorProfile?.id}
        doctorEmail={doctorProfile?.email}
        configured={dbConnected}
        onNavigate={onNavigate}
        consultationHours={doctorProfile?.consultation_hours}
      />
    </div>
  );
}
