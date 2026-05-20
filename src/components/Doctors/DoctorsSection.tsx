import { useState } from 'react';
import type { Doctor } from '../../types/doctor';
import DoctorProfilePage from './DoctorProfilePage';
import DoctorsList from './DoctorsList';

export default function DoctorsSection() {
  const [profileDoctorId, setProfileDoctorId] = useState<string | null>(null);

  if (profileDoctorId) {
    return <DoctorProfilePage doctorId={profileDoctorId} onBack={() => setProfileDoctorId(null)} />;
  }

  return <DoctorsList onViewProfile={(doctor: Doctor) => setProfileDoctorId(doctor.id)} />;
}
