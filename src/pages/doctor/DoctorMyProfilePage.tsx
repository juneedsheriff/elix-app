import { useSearchParams } from 'react-router-dom';
import SectionCard from '../../components/ui/SectionCard';
import { useSupabase } from '../../context/SupabaseProvider';
import type { ScreenPageProps } from '../types';
import '../admin/doctors/doctors-management.css';
import DoctorConsultationPricingSection from './DoctorConsultationPricingSection';
import DoctorMyProfileForm from './DoctorMyProfileForm';
import DoctorSchedulerForm from './DoctorSchedulerForm';

type ProfileTab = 'profile' | 'scheduler';

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'profile', label: 'Doctor profile' },
  { id: 'scheduler', label: 'Scheduler' }
];

type DoctorMyProfilePageProps = ScreenPageProps;

export default function DoctorMyProfilePage({ doctorProfile }: DoctorMyProfilePageProps) {
  const { refreshDoctorProfile } = useSupabase();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: ProfileTab = tabParam === 'scheduler' ? 'scheduler' : 'profile';

  if (!doctorProfile) {
    return (
      <SectionCard title='My profile' subtitle='Doctor account'>
        <p className='muted'>Sign in as a doctor to edit your profile.</p>
      </SectionCard>
    );
  }

  const setTab = (tab: ProfileTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'profile') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleSaved = async () => {
    await refreshDoctorProfile();
  };

  return (
    <div className='elixhealth-profile-page screen-grid'>
      <SectionCard
        title='My profile'
        subtitle={
          activeTab === 'scheduler'
            ? 'Set availability, breaks, and calendar preferences'
            : 'Update your photo, public profile, and consultation fees'
        }
      >
        <div className='elixhealth-profile-tabs' role='tablist' aria-label='Profile sections'>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type='button'
              role='tab'
              aria-selected={activeTab === id}
              className={
                activeTab === id
                  ? 'elixhealth-profile-tab elixhealth-profile-tab--active'
                  : 'elixhealth-profile-tab'
              }
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' ? (
          <div className='elixhealth-tab-panel' role='tabpanel'>
            <DoctorMyProfileForm doctor={doctorProfile} onSaved={() => void handleSaved()} />
            <div className='elixhealth-profile-pricing'>
              <DoctorConsultationPricingSection
                doctorProfile={doctorProfile}
                onUpdated={() => void handleSaved()}
              />
            </div>
          </div>
        ) : (
          <div className='elixhealth-tab-panel' role='tabpanel'>
            <DoctorSchedulerForm doctor={doctorProfile} onSaved={() => void handleSaved()} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
