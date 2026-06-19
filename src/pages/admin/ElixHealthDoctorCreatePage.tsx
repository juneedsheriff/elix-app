import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { canCreateDoctors } from '../../lib/staffPermissions';
import AdminDoctorCreateForm from './forms/AdminDoctorCreateForm';
import { doctorEditUrl, ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import { useElixHealthStaff } from './ElixHealthStaffContext';

export default function ElixHealthDoctorCreatePage() {
  const staff = useElixHealthStaff();
  const navigate = useNavigate();
  const canEdit = canCreateDoctors(staff);

  if (!canEdit) {
    return (
      <div className='elixhealth-edit-page'>
        <Link to={ELIX_HEALTH_PATHS.doctors} className='elixhealth-back-link'>
          <ArrowLeft size={18} aria-hidden />
          Back to doctors
        </Link>
        <p className='auth-error' role='alert'>
          You do not have permission to add doctors.
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
          clinicId={staff.clinic_id}
          onCancel={() => navigate(ELIX_HEALTH_PATHS.doctors)}
          onCreated={(doctor) => {
            navigate(doctorEditUrl(doctor.id, 'login'), { replace: true });
          }}
        />
      </SectionCard>
    </div>
  );
}
