import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { fetchDoctorById } from '../../lib/doctors';
import type { Doctor } from '../../types/doctor';
import { canEditProfiles } from '../../lib/staffPermissions';
import AdminDoctorEditForm from './forms/AdminDoctorEditForm';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import { useElixHealthStaff } from './ElixHealthStaffContext';

export default function ElixHealthDoctorEditPage() {
  const staff = useElixHealthStaff();
  const readOnly = !canEditProfiles(staff);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const doctorId = searchParams.get('id');

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!doctorId) {
      setDoctor(null);
      setLoading(false);
      setError('Missing doctor id in URL.');
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchDoctorById(doctorId);
    if (fetchError || !data) {
      setDoctor(null);
      setError(fetchError?.message ?? 'Doctor not found.');
    } else {
      setDoctor(data);
    }
    setLoading(false);
  }, [doctorId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!doctorId) {
    return (
      <div className='elixhealth-edit-page'>
        <Link to={ELIX_HEALTH_PATHS.doctors} className='elixhealth-back-link'>
          <ArrowLeft size={18} aria-hidden />
          Back to doctors
        </Link>
        <p className='auth-error' role='alert'>
          Invalid URL. Use <code>/elixhealth/doctor?id=…</code>
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

      {loading ? (
        <p className='elixhealth-status'>
          <Loader2 size={18} className='spin' aria-hidden /> Loading doctor…
        </p>
      ) : null}

      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      {!loading && !error && doctor ? (
        <SectionCard title={readOnly ? 'View doctor profile' : 'Edit doctor profile'} subtitle={doctor.full_name}>
          <AdminDoctorEditForm
            doctor={doctor}
            readOnly={readOnly}
            onSaved={() => {
              navigate(ELIX_HEALTH_PATHS.doctors, { replace: true });
            }}
            onAuthChanged={() => void load()}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
