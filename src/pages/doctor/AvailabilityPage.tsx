import SectionCard from '../../components/ui/SectionCard';
import { useSupabase } from '../../context/SupabaseProvider';
import type { ScreenPageProps } from '../types';
import DoctorSchedulerForm from './DoctorSchedulerForm';

export default function AvailabilityPage({ doctorProfile }: ScreenPageProps) {
  const { refreshDoctorProfile } = useSupabase();

  if (!doctorProfile) {
    return (
      <SectionCard title='Scheduler' subtitle='Consultation calendar settings'>
        <p className='muted'>Sign in as a doctor to manage your schedule.</p>
      </SectionCard>
    );
  }

  return (
    <div className='elixhealth-profile-page screen-grid'>
      <SectionCard
        title='Scheduler'
        subtitle='Set availability, breaks, and calendar preferences for consultations'
      >
        <DoctorSchedulerForm
          doctor={doctorProfile}
          onSaved={() => {
            void refreshDoctorProfile();
          }}
        />
      </SectionCard>
    </div>
  );
}
