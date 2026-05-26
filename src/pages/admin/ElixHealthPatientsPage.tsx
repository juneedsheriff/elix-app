import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { fetchAllPatientsForAdmin } from '../../lib/admins';
import type { Patient } from '../../types/patient';
import { patientEditUrl } from './elixHealthRoutes';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export default function ElixHealthPatientsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);

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

  return (
    <SectionCard title='Patients' subtitle={`${patients.length} registered`}>
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
            {patients.map((patient) => (
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
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {patients.length === 0 ? <p className='muted'>No patients in the database.</p> : null}
      </div>
    </SectionCard>
  );
}
