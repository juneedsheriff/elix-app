import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Search } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { formatConsultationFeeUsd } from '../../lib/doctors';
import { fetchAllDoctorsForAdmin } from '../../lib/admins';
import { canEditProfiles } from '../../lib/staffPermissions';
import type { Doctor } from '../../types/doctor';
import { doctorEditUrl } from './elixHealthRoutes';
import { useElixHealthStaff } from './ElixHealthStaffContext';

function loginCell(doctor: { auth_user_id?: string | null; login_disabled?: boolean }) {
  if (!doctor.auth_user_id) return 'No login';
  return doctor.login_disabled ? 'Disabled' : 'Enabled';
}

function cell(value: string | null | undefined) {
  const v = value?.trim();
  return v ? v : '—';
}

function matchesDoctorSearch(doctor: Doctor, query: string) {
  const haystack = [
    doctor.full_name,
    doctor.email,
    doctor.specialty,
    doctor.clinic_name,
    doctor.hospital,
    doctor.clinic_city,
    doctor.country,
    doctor.clinic_country,
    doctor.mobile_no,
    doctor.phone,
    doctor.gender
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function ElixHealthDoctorsPage() {
  const staff = useElixHealthStaff();
  const canEdit = canEditProfiles(staff);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [query, setQuery] = useState('');

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

  const normalizedQuery = query.trim().toLowerCase();

  const filteredDoctors = useMemo(() => {
    if (!normalizedQuery) return doctors;
    return doctors.filter((doctor) => matchesDoctorSearch(doctor, normalizedQuery));
  }, [doctors, normalizedQuery]);

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

  const subtitle = normalizedQuery
    ? `${filteredDoctors.length} of ${doctors.length} doctors`
    : `${doctors.length} registered`;

  return (
    <SectionCard title='Doctors' subtitle={subtitle}>
      <label className='doctor-search elixhealth-table-search'>
        <Search size={16} aria-hidden />
        <input
          type='search'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search by name, email, specialty, clinic, city, or phone'
          aria-label='Search doctors'
        />
      </label>

      <div className='elixhealth-table-wrap elixhealth-table-wrap--scroll'>
        <table className='elixhealth-table elixhealth-table--compact elixhealth-table--sticky-edges'>
          <thead>
            <tr>
              <th className='elixhealth-table__col-sticky-start elixhealth-table__col-name'>Full name</th>
              <th>Gender</th>
              <th>Mobile no.</th>
              <th>Email ID</th>
              <th>Specialty</th>
              <th className='elixhealth-table__col-clinic'>Clinic name</th>
              <th>City</th>
              <th>Country</th>
              <th>Fee</th>
              <th>Login</th>
              <th className='elixhealth-table__col-sticky-end' aria-label='Actions' />
            </tr>
          </thead>
          <tbody>
            {filteredDoctors.map((doctor) => (
              <tr key={doctor.id}>
                <td className='elixhealth-table__col-sticky-start elixhealth-table__col-name'>
                  {doctor.full_name}
                </td>
                <td>{cell(doctor.gender)}</td>
                <td>{cell(doctor.mobile_no ?? doctor.phone)}</td>
                <td>{cell(doctor.email)}</td>
                <td>{doctor.specialty}</td>
                <td className='elixhealth-table__col-clinic'>{cell(doctor.clinic_name ?? doctor.hospital)}</td>
                <td>{cell(doctor.clinic_city)}</td>
                <td>{cell(doctor.clinic_country ?? doctor.country)}</td>
                <td>{formatConsultationFeeUsd(doctor.consultation_fee ?? doctor.fee_usd)}</td>
                <td>{loginCell(doctor)}</td>
                <td className='elixhealth-table__col-sticky-end'>
                  <Link to={doctorEditUrl(doctor.id)} className='elixhealth-row-action'>
                    <Pencil size={15} aria-hidden />
                    {canEdit ? 'Edit' : 'View'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {doctors.length === 0 ? <p className='muted'>No doctors in the database.</p> : null}
        {doctors.length > 0 && filteredDoctors.length === 0 ? (
          <p className='muted'>No doctors match your search.</p>
        ) : null}
      </div>
    </SectionCard>
  );
}
