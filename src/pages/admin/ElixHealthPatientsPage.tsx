import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Search } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { fetchAllPatientsForAdmin } from '../../lib/admins';
import { canEditProfiles } from '../../lib/staffPermissions';
import type { Patient } from '../../types/patient';
import { patientEditUrl } from './elixHealthRoutes';
import { useElixHealthStaff } from './ElixHealthStaffContext';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function matchesPatientSearch(patient: Patient, query: string) {
  const haystack = [
    patient.elix_id,
    patient.full_name,
    patient.email,
    patient.phone,
    patient.city,
    patient.country,
    patient.gender,
    patient.blood_group
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function ElixHealthPatientsPage() {
  const staff = useElixHealthStaff();
  const canEdit = canEditProfiles(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchAllPatientsForAdmin();
    if (fetchError) {
      setError(fetchError.message);
      setPatients([]);
    } else {
      setPatients(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPatients = useMemo(() => {
    if (!normalizedQuery) return patients;
    return patients.filter((patient) => matchesPatientSearch(patient, normalizedQuery));
  }, [patients, normalizedQuery]);

  if (loading) {
    return (
      <p className='elixhealth-status'>
        <Loader2 size={18} className='spin' aria-hidden /> Loading patients…
      </p>
    );
  }

  if (error) {
    return (
      <p className='auth-error' role='alert'>
        {error}
      </p>
    );
  }

  const subtitle = normalizedQuery
    ? `${filteredPatients.length} of ${patients.length} patients`
    : `${patients.length} registered`;

  return (
    <SectionCard title='Patients' subtitle={subtitle}>
      <label className='doctor-search elixhealth-table-search'>
        <Search size={16} aria-hidden />
        <input
          type='search'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search by Elix ID, name, email, phone, or location'
          aria-label='Search patients'
        />
      </label>

      <div className='elixhealth-table-wrap'>
        <table className='elixhealth-table'>
          <thead>
            <tr>
              <th>Elix ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Joined</th>
              <th>Login</th>
              <th aria-label='Actions' />
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.id}>
                <td>
                  <code>{patient.elix_id}</code>
                </td>
                <td>{patient.full_name}</td>
                <td>{patient.email}</td>
                <td>{patient.phone ?? '—'}</td>
                <td>{[patient.city, patient.country].filter(Boolean).join(', ') || '—'}</td>
                <td>{formatDate(patient.created_at)}</td>
                <td>
                  {!patient.auth_user_id ? 'No login' : patient.login_disabled ? 'Disabled' : 'Enabled'}
                </td>
                <td>
                  <Link to={patientEditUrl(patient.id)} className='elixhealth-row-action'>
                    <Pencil size={15} aria-hidden />
                    {canEdit ? 'Edit' : 'View'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {patients.length === 0 ? <p className='muted'>No patients in the database.</p> : null}
        {patients.length > 0 && filteredPatients.length === 0 ? (
          <p className='muted'>No patients match your search.</p>
        ) : null}
      </div>
    </SectionCard>
  );
}
