import SectionCard from '../../components/ui/SectionCard';

export default function NotificationsPage() {
  return (
    <SectionCard title='Notifications center' subtitle='Push, SMS, and Email orchestration'>
      <ul className='list'>
        <li>
          <strong>Appointment reminder</strong>
          <span>Dr. Rossi in 2 hours • Push + SMS sent</span>
        </li>
        <li>
          <strong>AI summary updated</strong>
          <span>3 translated reports added to timeline</span>
        </li>
        <li>
          <strong>Prescription available</strong>
          <span>Secure download enabled for 72 hours</span>
        </li>
      </ul>
    </SectionCard>
  );
}
