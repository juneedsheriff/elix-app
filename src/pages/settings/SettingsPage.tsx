import { Check, Mail, User, WifiOff } from 'lucide-react';
import ElixLogo from '../../components/ui/ElixLogo';
import PatientProfileEditSection from '../../components/patient/PatientProfileEditSection';
import SectionCard from '../../components/ui/SectionCard';
import type { ScreenPageProps } from '../types';
import './settings-page.css';

export default function SettingsPage({
  userId,
  userEmail,
  doctorProfile,
  patientProfile,
  dbConnected
}: ScreenPageProps) {
  return (
    <div className='screen-grid settings-page'>
      <section className='settings-hero-banner' aria-labelledby='settings-hero-heading'>
        <div className='settings-hero-banner__content'>
          <h2 id='settings-hero-heading' className='settings-hero-banner__title'>
            ElixClinix  <span
              className={`settings-hero-badge ${
                dbConnected ? 'settings-hero-badge--connected' : 'settings-hero-badge--disconnected'
              }`}
            >
              {dbConnected ? (
                <Check size={12} strokeWidth={3} aria-hidden />
              ) : (
                <WifiOff size={12} strokeWidth={2.25} aria-hidden />
              )}
              {dbConnected ? 'Connected' : 'Not connected'}
            </span>
          </h2>
          <p className='settings-hero-banner__text'>  Doctor Consultation</p>
          <div className='settings-hero-banner__badges'>
           
            <span
              className={`settings-hero-badge ${
                userEmail ? 'settings-hero-badge--account' : 'settings-hero-badge--guest'
              }`}
            >
              {userEmail ? (
                <Mail size={12} strokeWidth={2.25} aria-hidden />
              ) : (
                <User size={12} strokeWidth={2.25} aria-hidden />
              )}
              <span className='settings-hero-badge__label'>
                {userEmail ?? 'Guest / demo mode'}
              </span>
            </span>
          </div>
        </div>
        <div className='settings-hero-banner__art' aria-hidden>
          <ElixLogo className='settings-hero-banner__logo' width={72} height={72} />
        </div>
      </section>

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
        <PatientProfileEditSection patientProfile={patientProfile} userId={userId} />
      ) : userEmail && !doctorProfile ? (
        <SectionCard title='Patient profile' subtitle='Complete your health profile'>
          <p className='muted'>Sign in again to sync your profile to the patients table.</p>
        </SectionCard>
      ) : null}

   
    </div>
  );
}
