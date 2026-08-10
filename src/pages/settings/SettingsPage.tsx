import { Check, Mail, User, WifiOff } from 'lucide-react';
import ElixLogo from '../../components/ui/ElixLogo';
import PatientProfileEditSection from '../../components/patient/PatientProfileEditSection';
import SectionCard from '../../components/ui/SectionCard';
import { useSupabase } from '../../context/SupabaseProvider';
import {
  avatarColorFromName,
  displayInitials,
  resolveProfilePhotoUrl
} from '../../lib/avatarDisplay';
import type { ScreenPageProps } from '../types';
import DoctorConsultationPricingSection from '../doctor/DoctorConsultationPricingSection';
import DoctorMyProfileForm from '../doctor/DoctorMyProfileForm';
import './settings-page.css';

export default function SettingsPage({
  userId,
  userEmail,
  doctorProfile,
  patientProfile,
  dbConnected
}: ScreenPageProps) {
  const { refreshDoctorProfile } = useSupabase();
  const photoUrl = resolveProfilePhotoUrl(doctorProfile?.image_url);
  const initials = displayInitials(doctorProfile?.full_name ?? userEmail);
  const avatarBg = avatarColorFromName(doctorProfile?.full_name ?? userEmail);

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
          {doctorProfile ? (
            photoUrl ? (
              <img
                src={photoUrl}
                alt=''
                className='settings-hero-banner__doctor-photo'
                width={72}
                height={72}
              />
            ) : (
              <span
                className='settings-hero-banner__doctor-initials'
                style={{ background: avatarBg }}
              >
                {initials}
              </span>
            )
          ) : (
            <ElixLogo className='settings-hero-banner__logo' width={72} height={72} />
          )}
        </div>
      </section>

      {doctorProfile ? (
        <>
          <SectionCard title='My profile' subtitle='Update your photo and public profile details'>
            <DoctorMyProfileForm
              doctor={doctorProfile}
              onSaved={() => void refreshDoctorProfile()}
            />
          </SectionCard>
          <DoctorConsultationPricingSection
            doctorProfile={doctorProfile}
            onUpdated={() => void refreshDoctorProfile()}
          />
        </>
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
