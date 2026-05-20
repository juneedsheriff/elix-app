import MetricCard from '../../components/ui/MetricCard';
import SectionCard from '../../components/ui/SectionCard';

export default function AvailabilityPage() {
  return (
    <SectionCard title='Availability and global scheduling' subtitle='Timezone-smart calendar with slot automation'>
      <div className='metrics-grid'>
        <MetricCard title='Next open slot' value='14:30 UTC' subtitle='Automatically synced to patient timezone' />
        <MetricCard title='Booked this week' value='27' subtitle='11 video, 16 async reviews' />
      </div>
    </SectionCard>
  );
}
