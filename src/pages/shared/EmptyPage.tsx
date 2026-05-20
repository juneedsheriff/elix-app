import SectionCard from '../../components/ui/SectionCard';

export default function EmptyPage() {
  return (
    <SectionCard title='No data yet' subtitle='Beautiful empty state'>
      <p className='muted'>Nothing to show on this screen right now.</p>
    </SectionCard>
  );
}
