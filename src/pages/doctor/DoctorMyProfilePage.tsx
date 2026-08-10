import SectionCard from '../../components/ui/SectionCard';
import { useSupabase } from '../../context/SupabaseProvider';
import type { ScreenPageProps } from '../types';
import DoctorConsultationPricingSection from './DoctorConsultationPricingSection';
import DoctorMyProfileForm from './DoctorMyProfileForm';

type DoctorMyProfilePageProps = ScreenPageProps;

export default function DoctorMyProfilePage({ doctorProfile }: DoctorMyProfilePageProps) {
  const { refreshDoctorProfile } = useSupabase();

  if (!doctorProfile) {
    return (
      <SectionCard title='My profile' subtitle='Doctor account'>
        <p className='muted'>Sign in as a doctor to edit your profile.</p>
      </SectionCard>
    );
  }

  const handleSaved = async () => {
    await refreshDoctorProfile();
  };

  return (
    <div className='elixhealth-profile-page screen-grid'>
      <SectionCard title='My profile' subtitle='Update your photo and public profile details'>
        <DoctorMyProfileForm doctor={doctorProfile} onSaved={() => void handleSaved()} />
      </SectionCard>

      <DoctorConsultationPricingSection
        doctorProfile={doctorProfile}
        onUpdated={() => void handleSaved()}
      />
    </div>
  );
}
