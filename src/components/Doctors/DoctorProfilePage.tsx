import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseProvider';
import { fetchPatientBrowseDoctorById } from '../../lib/doctors';
import {
  clearPendingOpinionRequest,
  getPendingOpinionRequest
} from '../../lib/navigation/pendingOpinionRequest';
import type { Doctor } from '../../types/doctor';
import DoctorProfilePanel from './DoctorProfilePanel';
import GetOpinionForm from './GetOpinionForm';

type DoctorProfilePageProps = {
  doctorId: string;
  initialDoctor?: Doctor | null;
  onBack: () => void;
};

type View = 'profile' | 'opinion';

export default function DoctorProfilePage({ doctorId, initialDoctor = null, onBack }: DoctorProfilePageProps) {
  const { patientProfile } = useSupabase();
  const patientClinicId = patientProfile?.clinic_id ?? null;
  const [doctor, setDoctor] = useState<Doctor | null>(initialDoctor);
  const [loading, setLoading] = useState(!initialDoctor);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('profile');

  const loadProfile = useCallback(async (id: string, seed: Doctor | null) => {
    setLoading(true);
    setError(null);
    setDoctor(seed);

    const { data, error: fetchError } = await fetchPatientBrowseDoctorById(id, { patientClinicId });

    if (fetchError) {
      setError(fetchError.message);
    } else if (!data) {
      setError('Doctor not found.');
    } else {
      setDoctor(data);
    }
    setLoading(false);
  }, [patientClinicId]);

  useEffect(() => {
    setView('profile');
    void loadProfile(doctorId, initialDoctor);
  }, [doctorId, initialDoctor, loadProfile]);

  useEffect(() => {
    if (!doctor) return;
    const pending = getPendingOpinionRequest();
    if (pending?.flow === 'doctor-opinion' && pending.doctorId === doctor.id) {
      setView('opinion');
      clearPendingOpinionRequest();
    }
  }, [doctor]);

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
