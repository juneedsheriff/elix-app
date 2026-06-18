import { useState } from 'react';
import type { Doctor } from '../../types/doctor';
import { getPendingOpinionRequest } from '../../lib/navigation/pendingOpinionRequest';
import DoctorProfilePage from './DoctorProfilePage';
import DoctorsList from './DoctorsList';

export default function DoctorsSection() {
  const [profileDoctorId, setProfileDoctorId] = useState<string | null>(() => {
    const pending = getPendingOpinionRequest();
    return pending?.flow === 'doctor-opinion' ? pending.doctorId : null;
  });

  if (profileDoctorId) {
    return <DoctorProfilePage doctorId={profileDoctorId} onBack={() => setProfileDoctorId(null)} />;
  }

  return <DoctorsList onViewProfile={(doctor: Doctor) => setProfileDoctorId(doctor.id)} />;
}
