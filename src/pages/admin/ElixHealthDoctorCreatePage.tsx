import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { canEditProfiles } from '../../lib/staffPermissions';
import AdminDoctorCreateForm from './forms/AdminDoctorCreateForm';
import { doctorEditUrl, ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import { useElixHealthStaff } from './ElixHealthStaffContext';

export default function ElixHealthDoctorCreatePage() {
  const staff = useElixHealthStaff();
  const navigate = useNavigate();
  const canEdit = canEditProfiles(staff);

  if (!canEdit) {
    return (
      <div className='elixhealth-edit-page'>
        <Link to={ELIX_HEALTH_PATHS.doctors} className='elixhealth-back-link'>
          <ArrowLeft size={18} aria-hidden />
          Back to doctors
        </Link>
        <p className='auth-error' role='alert'>
          Only administrators can add doctors.
        </p>
      </div>
    );
  }

  return (
    <div className='elixhealth-edit-page'>
      <Link to={ELIX_HEALTH_PATHS.doctors} className='elixhealth-back-link'>
        <ArrowLeft size={18} aria-hidden />
        Back to doctors
      </Link>

      <SectionCard title='Add doctor' subtitle='New provider profile'>
        <AdminDoctorCreateForm
          onCancel={() => navigate(ELIX_HEALTH_PATHS.doctors)}
          onCreated={(doctor) => {
            navigate(doctorEditUrl(doctor.id, 'login'), { replace: true });
          }}
        />
      </SectionCard>
    </div>
  );
}
