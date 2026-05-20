import MetricCard from '../../components/ui/MetricCard';
import SectionCard from '../../components/ui/SectionCard';

export default function AdminDashboardPage() {
  return (
    <div className='screen-grid'>
      <SectionCard title='Platform operations dashboard' subtitle='Revenue, compliance, growth, and quality in real-time'>
        <div className='metrics-grid'>
          <MetricCard title='Total users' value='182K' subtitle='Patients across 42 countries' />
          <MetricCard title='Verified doctors' value='5,620' subtitle='License and KYC validated' />
          <MetricCard title='Active consultations' value='1,448' subtitle='Across chat, audio, and video' />
          <MetricCard title='MRR' value='$2.3M' subtitle='12.2% growth MoM' />
        </div>
      </SectionCard>
      <SectionCard title='Country-wise activity'>
        <div className='bar-chart'>
          <div style={{ width: '82%' }}>India 82%</div>
          <div style={{ width: '71%' }}>United States 71%</div>
          <div style={{ width: '54%' }}>UAE 54%</div>
          <div style={{ width: '49%' }}>UK 49%</div>
        </div>
      </SectionCard>
    </div>
  );
}
