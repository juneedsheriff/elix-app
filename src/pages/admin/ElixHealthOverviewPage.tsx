import { useCallback, useEffect, useState } from 'react';
import { Loader2, Stethoscope, UserCircle, Users } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import MetricCard from '../../components/ui/MetricCard';
import { fetchAllAdmins, fetchAllDoctorsForAdmin, fetchAllPatientsForAdmin } from '../../lib/admins';

export default function ElixHealthOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorCount, setDoctorCount] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [activeStaff, setActiveStaff] = useState(0);
  const [linkedDoctors, setLinkedDoctors] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [doctorsRes, patientsRes, staffRes] = await Promise.all([
      fetchAllDoctorsForAdmin(),
      fetchAllPatientsForAdmin(),
      fetchAllAdmins()
    ]);

    if (doctorsRes.error || patientsRes.error || staffRes.error) {
      setError(
        doctorsRes.error?.message ??
          patientsRes.error?.message ??
          staffRes.error?.message ??
          'Could not load directory data.'
      );
    } else {
      const doctors = doctorsRes.data ?? [];
      const staff = staffRes.data ?? [];
      setDoctorCount(doctors.length);
      setPatientCount((patientsRes.data ?? []).length);
      setActiveStaff(staff.filter((s) => s.is_active).length);
      setLinkedDoctors(doctors.filter((d) => d.auth_user_id).length);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className='elixhealth-status'>
        <Loader2 size={18} className='spin' aria-hidden /> Loading directory…
      </p>
    );
  }

  if (error) {
    return (
      <p className='auth-error' role='alert'>
        {error}. Ensure migrations 012 and 013 are applied in Supabase.
      </p>
    );
  }

  return (
    <div className='elixhealth-overview'>
      <div className='metrics-grid'>
        <MetricCard title='Doctors' value={String(doctorCount)} subtitle='Registered specialists' icon={Stethoscope} />
        <MetricCard title='Patients' value={String(patientCount)} subtitle='Patient profiles' icon={UserCircle} />
        <MetricCard title='Staff' value={String(activeStaff)} subtitle='Active admin accounts' icon={Users} />
        <MetricCard title='Linked doctors' value={String(linkedDoctors)} subtitle='With Supabase Auth login' icon={Users} />
      </div>
      <SectionCard title='Quick summary' subtitle='Platform directory at a glance'>
        <div className='elixhealth-summary-grid'>
          <div className='elixhealth-summary-item'>
            <span className='elixhealth-summary-label'>Total doctors</span>
            <strong>{doctorCount}</strong>
          </div>
          <div className='elixhealth-summary-item'>
            <span className='elixhealth-summary-label'>Total patients</span>
            <strong>{patientCount}</strong>
          </div>
          <div className='elixhealth-summary-item'>
            <span className='elixhealth-summary-label'>Active staff</span>
            <strong>{activeStaff}</strong>
          </div>
          <div className='elixhealth-summary-item'>
            <span className='elixhealth-summary-label'>Doctors with login</span>
            <strong>{linkedDoctors}</strong>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
