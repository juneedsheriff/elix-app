import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Pencil, Trash2 } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { formatConsultationFeeUsd } from '../../lib/doctors';
import { deleteDoctorForAdmin, fetchAllDoctorsForAdmin, setDoctorVisibilityForAdmin } from '../../lib/admins';
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const handleVisibility = async (doctor: Doctor) => {
    const nextVisible = doctor.is_visible === false;
    setBusyId(doctor.id);
    setActionMessage(null);

    const { error: visibilityError } = await setDoctorVisibilityForAdmin(doctor.id, nextVisible);
    setBusyId(null);

    if (visibilityError) {
      setActionMessage(visibilityError.message);
      return;
    }

    setActionMessage(`${doctor.full_name} is now ${nextVisible ? 'visible in' : 'hidden from'} patient search.`);
    void load();
  };

  const handleDelete = async (doctor: Doctor) => {
    const confirmed = window.confirm(
      `Delete ${doctor.full_name}? This hides the doctor from patient search and removes them from the active admin list.`
    );
    if (!confirmed) return;

    setBusyId(doctor.id);
    setActionMessage(null);

    const { error: deleteError } = await deleteDoctorForAdmin(doctor.id);
    setBusyId(null);

    if (deleteError) {
      setActionMessage(deleteError.message);
      return;
    }

    setActionMessage(`${doctor.full_name} was deleted from active doctor listings.`);
    void load();
  };

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
      {actionMessage ? (
        <p className='elixhealth-success' role='status'>
          {actionMessage}
        </p>
      ) : null}

      <div className='elixhealth-table-wrap elixhealth-table-wrap--wide'>
        <table className='elixhealth-table elixhealth-table--compact'>
          <thead>
            <tr>
              <th>Full name</th>
              <th>Gender</th>
              <th>Mobile no.</th>
              <th>Email ID</th>
              <th>Qualification</th>
              <th>Specialty</th>
              <th>Clinic name</th>
              <th>City</th>
              <th>Country</th>
              <th>Fee</th>
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
                <td>{cell(doctor.qualification)}</td>
                <td>{doctor.specialty}</td>
                <td>{cell(doctor.clinic_name ?? doctor.hospital)}</td>
                <td>{cell(doctor.clinic_city)}</td>
                <td>{cell(doctor.clinic_country ?? doctor.country)}</td>
                <td>{formatConsultationFeeUsd(doctor.consultation_fee ?? doctor.fee_usd)}</td>
                <td>{loginCell(doctor)}</td>
                <td>
                  <div className='elixhealth-table-actions'>
                    <Link to={doctorEditUrl(doctor.id)} className='elixhealth-row-action'>
                      <Pencil size={15} aria-hidden />
                      Edit
                    </Link>
                    <button
                      type='button'
                      className='elixhealth-row-action'
                      disabled={busyId === doctor.id}
                      onClick={() => void handleVisibility(doctor)}
                    >
                      {doctor.is_visible === false ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
                      {doctor.is_visible === false ? 'Show' : 'Hide'}
                    </button>
                    <button
                      type='button'
                      className='elixhealth-row-action elixhealth-row-action--danger'
                      disabled={busyId === doctor.id}
                      onClick={() => void handleDelete(doctor)}
                    >
                      {busyId === doctor.id ? (
                        <Loader2 size={15} className='spin' aria-hidden />
                      ) : (
                        <Trash2 size={15} aria-hidden />
                      )}
                      Delete
                    </button>
                  </div>
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
