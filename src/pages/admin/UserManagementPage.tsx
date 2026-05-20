import SectionCard from '../../components/ui/SectionCard';

export default function UserManagementPage() {
  return (
    <div className='screen-grid'>
      <SectionCard title='Admin controls' subtitle='Verify doctors, moderate content, resolve disputes'>
        <ul className='list'>
          <li>
            <strong>Doctor verification queue</strong>
            <span>41 licenses pending manual validation</span>
          </li>
          <li>
            <strong>Fraud alerts</strong>
            <span>6 suspicious payment flows flagged by AI risk engine</span>
          </li>
          <li>
            <strong>Support tickets</strong>
            <span>112 open tickets • SLA 96% on target</span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
