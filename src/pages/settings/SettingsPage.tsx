import SectionCard from '../../components/ui/SectionCard';
import Tag from '../../components/ui/Tag';
import type { ScreenPageProps } from '../types';

export default function SettingsPage({
  userEmail,
  doctorProfile,
  patientProfile,
  dbConnected,
  onSignOut
}: ScreenPageProps) {
  return (
    <div className='screen-grid'>
      <SectionCard title='Database' subtitle='Elix'>
        <div className='feature-row'>
          <Tag label={dbConnected ? 'Connected' : 'Not connected'} />
          {userEmail ? <Tag label={userEmail} /> : <Tag label='Guest / demo mode' />}
        </div>
        {onSignOut && userEmail ? (
          <button type='button' className='secondary-btn' onClick={onSignOut} style={{ marginTop: '0.75rem' }}>
            Sign out
          </button>
        ) : null}
      </SectionCard>

      {doctorProfile ? (
        <SectionCard title='Doctor account' subtitle='Login credentials on file'>
          <ul className='list doctor-credentials-list'>
            <li>
              <strong>{doctorProfile.full_name}</strong>
              <span>
                {doctorProfile.specialty} • {doctorProfile.hospital}
              </span>
            </li>
            <li>
              <strong>Email (login)</strong>
              <span>{doctorProfile.email}</span>
            </li>
            <li>
              <strong>Phone</strong>
              <span>{doctorProfile.phone}</span>
            </li>
          </ul>
          <p className='muted'>Change password via Forgot password on the sign-in screen.</p>
        </SectionCard>
      ) : null}

      {patientProfile ? (
        <SectionCard title='Patient profile' subtitle='Stored in patients table'>
          <ul className='list doctor-credentials-list'>
            <li>
              <strong>{patientProfile.full_name}</strong>
              <span>
                {[patientProfile.city, patientProfile.country].filter(Boolean).join(', ') || 'Location not set'}
              </span>
            </li>
            <li>
              <strong>Email</strong>
              <span>{patientProfile.email}</span>
            </li>
            {patientProfile.phone ? (
              <li>
                <strong>Phone</strong>
                <span>{patientProfile.phone}</span>
              </li>
            ) : null}
            {patientProfile.blood_group ? (
              <li>
                <strong>Blood group</strong>
                <span>{patientProfile.blood_group}</span>
              </li>
            ) : null}
            {patientProfile.allergies ? (
              <li>
                <strong>Allergies</strong>
                <span>{patientProfile.allergies}</span>
              </li>
            ) : null}
          </ul>
        </SectionCard>
      ) : userEmail ? (
        <SectionCard title='Patient profile' subtitle='Complete your health profile'>
          <p className='muted'>Sign in again to sync your profile to the patients table.</p>
        </SectionCard>
      ) : null}

      <SectionCard title='Health details'>
        <p className='muted'>
          Blood group, allergies, medications, emergency contacts, insurance, and language preferences are stored on
          your patient record.
        </p>
      </SectionCard>
    </div>
  );
}
