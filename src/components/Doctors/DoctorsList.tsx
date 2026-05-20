import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Star } from 'lucide-react';
import { fetchDoctors, formatConsultationFeeUsd } from '../../lib/doctors';
import type { Doctor } from '../../types/doctor';

function DoctorCard({ doctor, onSelect }: { doctor: Doctor; onSelect: (doctor: Doctor) => void }) {
  return (
    <article className='doctor-card'>
      <img
        className='doctor-avatar'
        src={doctor.image_url}
        alt={doctor.full_name}
        loading='lazy'
        width={72}
        height={72}
      />
      <div className='doctor-card-body'>
        <h4>{doctor.full_name}</h4>
        <p>
          {doctor.specialty} • {doctor.years_experience} years • {doctor.hospital}
        </p>
        <p className='doctor-meta-muted'>
          {doctor.country} • <Star size={12} className='inline-star' aria-hidden /> {doctor.rating.toFixed(1)}
        </p>
        <div className='tag-row'>
          <span className='tag'>{doctor.rating.toFixed(1)} rating</span>
          <span className='tag'>{doctor.languages}</span>
          <span className='tag'>{formatConsultationFeeUsd(doctor.fee_usd)}</span>
        </div>
        <button type='button' className='text-btn doctor-view-btn' onClick={() => onSelect(doctor)}>
          View profile
        </button>
      </div>
    </article>
  );
}

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
          <p>Filter by specialty, language, country, and fee</p>
        </div>

        <label className='doctor-search'>
          <Search size={18} aria-hidden />
          <input
            type='search'
            placeholder='Search doctors, specialty, hospital…'
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

        <div className='doctor-grid'>
          {filtered.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} onSelect={onViewProfile} />
          ))}
        </div>
      </section>
    </div>
  );
}
