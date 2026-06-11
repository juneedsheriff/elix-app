import MetricCard from '../../components/ui/MetricCard';
import SectionCard from '../../components/ui/SectionCard';
import DoctorConsultationPricingSection from './DoctorConsultationPricingSection';
import type { ScreenPageProps } from '../types';

export default function AvailabilityPage({ doctorProfile }: ScreenPageProps) {
  return (
    <div className='screen-grid'>
      <SectionCard title='Scheduler' subtitle='Consultation pricing and calendar settings'>
        <div className='metrics-grid'>
          <MetricCard title='Next open slot' value='14:30 UTC' subtitle='Automatically synced to patient timezone' />
          <MetricCard title='Booked this week' value='27' subtitle='11 video, 16 async reviews' />
        </div>
      </SectionCard>

      <DoctorConsultationPricingSection
        doctorProfile={doctorProfile}
        title='Consultation fees by duration'
        subtitle='Patients see these prices when they request a second opinion'
      />
    </div>
  );
}
