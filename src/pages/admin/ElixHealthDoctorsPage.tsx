import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { formatConsultationFeeUsd } from '../../lib/doctors';
import { fetchAllDoctorsForAdmin } from '../../lib/admins';
import type { Doctor } from '../../types/doctor';
import { doctorEditUrl } from './elixHealthRoutes';

function loginCell(doctor: { auth_user_id?: string | null; login_disabled?: boolean }) {
  if (!doctor.auth_user_id) return 'No login';
  return doctor.login_disabled ? 'Disabled' : 'Enabled';
}

function cell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

export default function ElixHealthDoctorsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchAllDoctorsForAdmin();
    if (fetchError) {
      setError(fetchError.message);
      setDoctors([]);
    } else {
      setDoctors(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className='elixhealth-status'>
        <Loader2 size={18} className='spin' aria-hidden /> Loading doctors…
      </p>
    );
  }

  if (error) {
    return (
      <p className='auth-error' role='alert'>
        {error}. Run migration 014_doctor_extended_profile.sql if columns are missing.
      </p>
    );
  }

  return (
    <SectionCard title='Doctors' subtitle={`${doctors.length} registered`}>
      <div className='elixhealth-table-wrap elixhealth-table-wrap--wide'>
        <table className='elixhealth-table elixhealth-table--compact'>
          <thead>
            <tr>
              <th>Full name</th>
              <th>Gender</th>
              <th>Mobile no.</th>
              <th>Email ID</th>
              <th>License no.</th>
              <th>Qualification</th>
              <th>Specialty</th>
              <th>Specialization</th>
              <th>Clinic name</th>
              <th>City</th>
              <th>Country</th>
              <th>Fee</th>
              <th>Priority</th>
              <th>Login</th>
              <th aria-label='Actions' />
            </tr>
          </thead>
          <tbody>
            {doctors.map((doctor) => (
              <tr key={doctor.id}>
                <td>{doctor.full_name}</td>
                <td>{cell(doctor.gender)}</td>
                <td>{cell(doctor.mobile_no ?? doctor.phone)}</td>
                <td>{cell(doctor.email)}</td>
                <td>{cell(doctor.medical_license_no)}</td>
                <td>{cell(doctor.qualification)}</td>
                <td>{doctor.specialty}</td>
                <td>{cell(doctor.specialization)}</td>
                <td>{cell(doctor.clinic_name ?? doctor.hospital)}</td>
                <td>{cell(doctor.clinic_city)}</td>
                <td>{cell(doctor.clinic_country ?? doctor.country)}</td>
                <td>{formatConsultationFeeUsd(doctor.consultation_fee ?? doctor.fee_usd)}</td>
                <td>{doctor.elix_patient_priority ? 'Yes' : 'No'}</td>
                <td>{loginCell(doctor)}</td>
                <td>
                  <Link to={doctorEditUrl(doctor.id)} className='elixhealth-row-action'>
                    <Pencil size={15} aria-hidden />
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {doctors.length === 0 ? <p className='muted'>No doctors in the database.</p> : null}
      </div>
    </SectionCard>
  );
}
