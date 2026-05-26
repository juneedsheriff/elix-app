import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { fetchPatientById } from '../../lib/patients';
import type { Patient } from '../../types/patient';
import AdminPatientEditForm from './forms/AdminPatientEditForm';
import { ELIX_HEALTH_PATHS } from './elixHealthRoutes';

export default function ElixHealthPatientEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('id');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) {
      setPatient(null);
      setLoading(false);
      setError('Missing patient id in URL.');
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchPatientById(patientId);
    if (fetchError || !data) {
      setPatient(null);
      setError(fetchError?.message ?? 'Patient not found.');
    } else {
      setPatient(data);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!patientId) {
    return (
      <div className='elixhealth-edit-page'>
        <Link to={ELIX_HEALTH_PATHS.patients} className='elixhealth-back-link'>
          <ArrowLeft size={18} aria-hidden />
          Back to patients
        </Link>
        <p className='auth-error' role='alert'>
          Invalid URL. Use <code>/elixhealth/patient?id=…</code>
        </p>
      </div>
    );
  }

  return (
    <div className='elixhealth-edit-page'>
      <Link to={ELIX_HEALTH_PATHS.patients} className='elixhealth-back-link'>
        <ArrowLeft size={18} aria-hidden />
        Back to patients
      </Link>

      {loading ? (
        <p className='elixhealth-status'>
          <Loader2 size={18} className='spin' aria-hidden /> Loading patient…
        </p>
      ) : null}

      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      {!loading && !error && patient ? (
        <SectionCard title='Edit patient profile' subtitle={`${patient.full_name} · ${patient.elix_id}`}>
          <AdminPatientEditForm
            patient={patient}
            onSaved={() => {
              navigate(ELIX_HEALTH_PATHS.patients, { replace: true });
            }}
            onAuthChanged={() => void load()}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
