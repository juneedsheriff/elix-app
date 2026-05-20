import { Loader2, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Doctor } from '../../types/doctor';

type DoctorProfilePanelProps = {
  doctor: Doctor | null;
  loading: boolean;
  error: string | null;
  footer?: ReactNode;
};

export default function DoctorProfilePanel({ doctor, loading, error, footer }: DoctorProfilePanelProps) {
  return (
    <section className='section-card doctor-profile-panel' aria-labelledby='doctor-profile-title'>
      <div className='section-head'>
        <h3 id='doctor-profile-title'>Doctor profile</h3>
        <p>KYC verified • licenses on file</p>
      </div>

      {loading ? (
        <p className='doctor-status' aria-live='polite'>
          <Loader2 size={18} className='spin' aria-hidden /> Loading profile…
        </p>
      ) : null}

      {error ? (
        <p className='auth-error' role='alert'>
          {error}
        </p>
      ) : null}

      {!loading && !error && doctor ? (
        <>
          <div className='doctor-profile-header'>
            <img className='doctor-avatar lg' src={doctor.image_url} alt={doctor.full_name} width={96} height={96} />
            <div>
              <h4>{doctor.full_name}</h4>
              <p className='muted'>
                {doctor.specialty} • {doctor.years_experience} years • {doctor.hospital}
              </p>
              <p className='doctor-rating-line'>
                <Star size={14} className='inline-star' aria-hidden />
                <span>{doctor.rating.toFixed(1)} patient rating</span>
              </p>
              <div className='tag-row'>
                <span className='tag'>{doctor.country}</span>
                <span className='tag'>{doctor.languages}</span>
                <span className='tag'>${doctor.fee_usd} consult</span>
              </div>
            </div>
          </div>

          <dl className='doctor-detail-grid'>
            <div>
              <dt>Specialty</dt>
              <dd>{doctor.specialty}</dd>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>{doctor.years_experience} years</dd>
            </div>
            <div>
              <dt>Hospital</dt>
              <dd>{doctor.hospital}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd>{doctor.country}</dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>{doctor.languages}</dd>
            </div>
            <div>
              <dt>Consultation fee</dt>
              <dd>${doctor.fee_usd} USD</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>{doctor.rating.toFixed(1)} / 5</dd>
            </div>
          </dl>

          <div className='doctor-bio-block'>
            <h5>About</h5>
            <p>{doctor.bio ?? 'No biography available for this specialist.'}</p>
          </div>

          {footer ? <div className='doctor-profile-footer'>{footer}</div> : null}
        </>
      ) : null}
    </section>
  );
}
