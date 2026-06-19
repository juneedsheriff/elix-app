import SectionCard from '../../components/ui/SectionCard';
import StaffProfileForm from './forms/StaffProfileForm';
import { useElixHealthStaff } from './ElixHealthStaffContext';

export default function ElixHealthMyProfilePage() {
  const { staff, refreshStaff } = useElixHealthStaff();

  return (
    <div className='elixhealth-profile-page'>
      <SectionCard title='My profile' subtitle='Update your name, email, or password'>
        <StaffProfileForm staff={staff} onSaved={() => void refreshStaff()} />
      </SectionCard>
    </div>
  );
}
