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
  const [profileDoctor, setProfileDoctor] = useState<Doctor | null>(null);

  if (profileDoctorId) {
    return (
      <DoctorProfilePage
        doctorId={profileDoctorId}
        initialDoctor={profileDoctor}
        onBack={() => {
          setProfileDoctorId(null);
          setProfileDoctor(null);
        }}
      />
    );
  }

  return (
    <DoctorsList
      onViewProfile={(doctor: Doctor) => {
        setProfileDoctor(doctor);
        setProfileDoctorId(doctor.id);
      }}
    />
  );
}
