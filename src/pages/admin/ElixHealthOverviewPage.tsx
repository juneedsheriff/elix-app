import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, KeyRound, Loader2, Stethoscope, UserCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import MetricCard from '../../components/ui/MetricCard';
import { fetchAllAdmins, fetchAllDoctorsForAdmin, fetchAllPatientsForAdmin } from '../../lib/admins';
import { fetchOpinionRequestsForStaff, isAssignedToPatientService, isPendingAdminAssignment } from '../../lib/opinionRequests';
import { isAdministrator } from '../../lib/staffPermissions';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';
import { useElixHealthStaff } from './ElixHealthStaffContext';

export default function ElixHealthOverviewPage() {
  const staff = useElixHealthStaff();
  const isAdmin = isAdministrator(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctorCount, setDoctorCount] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [activeStaff, setActiveStaff] = useState(0);
  const [linkedDoctors, setLinkedDoctors] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [doctorsRes, patientsRes, staffRes, requestsRes] = await Promise.all([
      fetchAllDoctorsForAdmin(),
      fetchAllPatientsForAdmin(),
      isAdmin ? fetchAllAdmins() : Promise.resolve({ data: [], error: null }),
      fetchOpinionRequestsForStaff()
    ]);

    if (doctorsRes.error || patientsRes.error || staffRes.error || requestsRes.error) {
      setError(
        doctorsRes.error?.message ??
          patientsRes.error?.message ??
          staffRes.error?.message ??
          requestsRes.error?.message ??
          'Could not load directory data.'
      );
    } else {
      const doctors = doctorsRes.data ?? [];
      const staffMembers = staffRes.data ?? [];
      const requests = requestsRes.data ?? [];
      setDoctorCount(doctors.length);
      setPatientCount((patientsRes.data ?? []).length);
      setActiveStaff(staffMembers.filter((member) => member.is_active).length);
      setLinkedDoctors(doctors.filter((doctor) => doctor.auth_user_id).length);
      setPendingRequests(
        isAdmin
          ? requests.filter(isPendingAdminAssignment).length
          : requests.filter(isAssignedToPatientService).length
      );
    }

    setLoading(false);
  }, [isAdmin]);

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
        {isAdmin ? (
          <MetricCard title='Staff' value={String(activeStaff)} subtitle='Active admin accounts' icon={Users} />
        ) : null}
        <MetricCard
          title='Linked doctors'
          value={String(linkedDoctors)}
          subtitle='With Supabase Auth login'
          icon={KeyRound}
        />
        <MetricCard
          title={isAdmin ? 'Pending requests' : 'My open requests'}
          value={String(pendingRequests)}
          subtitle={isAdmin ? 'Awaiting assignment to patient service' : 'Awaiting coordination'}
          icon={ClipboardList}
        />
      </div>
      {pendingRequests > 0 ? (
        <p className='elixhealth-overview-cta'>
          <Link to={ELIX_HEALTH_PATHS.requests}>
            Review {pendingRequests} pending request{pendingRequests === 1 ? '' : 's'}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
