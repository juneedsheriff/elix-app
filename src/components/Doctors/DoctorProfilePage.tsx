import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fetchDoctorById } from '../../lib/doctors';
import type { Doctor } from '../../types/doctor';
import DoctorProfilePanel from './DoctorProfilePanel';
import GetOpinionForm from './GetOpinionForm';

type DoctorProfilePageProps = {
  doctorId: string;
  onBack: () => void;
};

type View = 'profile' | 'opinion';

export default function DoctorProfilePage({ doctorId, onBack }: DoctorProfilePageProps) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('profile');

  const loadProfile = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setDoctor(null);

    const { data, error: fetchError } = await fetchDoctorById(id);

    if (fetchError) {
      setError(fetchError.message);
    } else if (!data) {
      setError('Doctor not found.');
    } else {
      setDoctor(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setView('profile');
    void loadProfile(doctorId);
  }, [doctorId, loadProfile]);

  if (view === 'opinion' && doctor) {
    return (
      <div className='doctors-screen'>
        <header className='doctors-subheader'>
          <button type='button' className='doctor-page-back' onClick={() => setView('profile')}>
            <ArrowLeft size={16} aria-hidden />
            Back
          </button>
          <div className='doctors-subheader-titles'>
            <h2>Request opinion</h2>
            <p>{doctor.full_name}</p>
          </div>
        </header>
        <GetOpinionForm doctor={doctor} onBack={() => setView('profile')} />
      </div>
    );
  }

  return (
    <div className='doctors-screen'>
      <header className='doctors-subheader'>
        <button type='button' className='doctor-page-back' onClick={onBack}>
          <ArrowLeft size={16} aria-hidden />
          Back
        </button>
        <div className='doctors-subheader-titles'>
          <h2>{doctor?.full_name ?? 'Doctor profile'}</h2>
          <p>{doctor?.specialty ?? 'Loading…'}</p>
        </div>
      </header>

      <DoctorProfilePanel
        doctor={doctor}
        loading={loading}
        error={error}
        footer={
          doctor ? (
            <button type='button' className='primary-btn wide' onClick={() => setView('opinion')}>
              Get opinion
            </button>
          ) : null
        }
      />
    </div>
  );
}
