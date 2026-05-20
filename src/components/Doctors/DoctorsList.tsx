import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Star } from 'lucide-react';
import { fetchDoctors, formatConsultationFeeUsd } from '../../lib/doctors';
import type { Doctor } from '../../types/doctor';

type DoctorsListProps = {
  onViewProfile: (doctor: Doctor) => void;
};

export default function DoctorsList({ onViewProfile }: DoctorsListProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await fetchDoctors(50);
      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setDoctors([]);
      } else {
        setDoctors(data ?? []);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.full_name.toLowerCase().includes(q) ||
        d.specialty.toLowerCase().includes(q) ||
        d.hospital.toLowerCase().includes(q) ||
        d.country.toLowerCase().includes(q) ||
        d.languages.toLowerCase().includes(q) ||
        String(d.fee_usd).includes(q) ||
        formatConsultationFeeUsd(d.fee_usd).toLowerCase().includes(q)
    );
  }, [doctors, query]);

  return (
    <div className='doctors-screen'>
      <header className='doctors-subheader'>
        <div className='doctors-subheader-titles'>
          <h2>Find a specialist</h2>
          <p>{doctors.length} verified doctors</p>
        </div>
      </header>

      <section className='section-card'>
        <div className='section-head'>
          <h3>Verified doctor network</h3>
          <p>Compare specialists and consultation fees (USD)</p>
        </div>

        <label className='doctor-search'>
          <Search size={18} aria-hidden />
          <input
            type='search'
            placeholder='Search doctors, specialty, hospital, fee…'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label='Search doctors'
          />
        </label>

        {loading ? (
          <p className='doctor-status' aria-live='polite'>
            <Loader2 size={18} className='spin' aria-hidden /> Loading doctors…
          </p>
        ) : null}

        {error ? (
          <p className='auth-error' role='alert'>
            {error}. Run <code>supabase/schema.sql</code> in the Supabase SQL Editor, then <code>npm run db:seed</code>,
            and refresh.
          </p>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <p className='muted'>No doctors match your search.</p>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className='doctors-table-wrap'>
            <table className='doctors-table'>
              <caption className='sr-only'>Verified doctors and consultation fees in US dollars</caption>
              <thead>
                <tr>
                  <th scope='col'>Doctor</th>
                  <th scope='col'>Specialty</th>
                  <th scope='col'>Location</th>
                  <th scope='col'>Rating</th>
                  <th scope='col' className='doctors-table-fee-col'>
                    Consultation fee
                  </th>
                  <th scope='col'>
                    <span className='sr-only'>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doctor) => (
                  <tr key={doctor.id}>
                    <td>
                      <div className='doctors-table-doctor'>
                        <img
                          className='doctor-avatar doctors-table-avatar'
                          src={doctor.image_url}
                          alt=''
                          loading='lazy'
                          width={48}
                          height={48}
                        />
                        <div>
                          <span className='doctors-table-name'>{doctor.full_name}</span>
                          <span className='doctors-table-meta'>{doctor.languages}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label='Specialty'>
                      <span>{doctor.specialty}</span>
                      <span className='doctors-table-meta'>{doctor.years_experience} years</span>
                    </td>
                    <td data-label='Location'>
                      <span>{doctor.hospital}</span>
                      <span className='doctors-table-meta'>{doctor.country}</span>
                    </td>
                    <td data-label='Rating'>
                      <span className='doctors-table-rating'>
                        <Star size={14} className='inline-star' aria-hidden />
                        {doctor.rating.toFixed(1)}
                      </span>
                    </td>
                    <td data-label='Consultation fee' className='doctors-table-fee-col'>
                      <span className='doctors-table-fee'>{formatConsultationFeeUsd(doctor.fee_usd)}</span>
                    </td>
                    <td>
                      <button type='button' className='text-btn' onClick={() => onViewProfile(doctor)}>
                        View profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
