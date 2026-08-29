import { Building2, Mail, MapPin, Phone } from 'lucide-react';
import {
  CLINIC_BRANCH_SERVICES,
  clinicBranchContactPhone,
  clinicBranchEmail,
  HEAD_OFFICE_EMAIL,
  HEAD_OFFICE_PHONE,
  type PseClinicBranch
} from '../../lib/clinicBranch';
import './patient-clinic-branch-card.css';

type PatientClinicBranchCardProps = {
  branch: PseClinicBranch | null;
  loading?: boolean;
};

export default function PatientClinicBranchCard({ branch, loading }: PatientClinicBranchCardProps) {
  if (loading && !branch) {
    return (
      <section className='pcb-card' aria-busy='true' aria-label='Your ElixClinix branch'>
        <p className='pcb-card__loading'>Loading your branch details…</p>
      </section>
    );
  }

  if (!branch) return null;

  const phone = clinicBranchContactPhone(branch);
  const email = clinicBranchEmail(branch);
  const location = branch.location?.trim() || null;

  return (
    <section className='pcb-card' aria-labelledby='pcb-card-heading'>
      <header className='pcb-card__head'>
        <span className='pcb-card__icon' aria-hidden>
          <Building2 size={18} strokeWidth={2} />
        </span>
        <div>
          <p className='pcb-card__eyebrow'>Your ElixClinix branch</p>
          <h2 id='pcb-card-heading'>{branch.name}</h2>
        </div>
      </header>

      <p className='pcb-card__intro'>
        Your patient profile is assigned to this branch based on your registered address and city.
        The local team can coordinate care and help you use the services available in your area.
      </p>

      <dl className='pcb-card__facts'>
        {location ? (
          <div>
            <dt>
              <MapPin size={14} aria-hidden />
              Location
            </dt>
            <dd>{location}</dd>
          </div>
        ) : null}
        <div>
          <dt>
            <Phone size={14} aria-hidden />
            Contact
          </dt>
          <dd>
            <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>
          </dd>
        </div>
        <div>
          <dt>
            <Mail size={14} aria-hidden />
            Email
          </dt>
          <dd>
            <a href={`mailto:${email}`}>{email}</a>
          </dd>
        </div>
      </dl>

      <div className='pcb-card__services'>
        <h3>Services available at this branch</h3>
        <ul>
          {CLINIC_BRANCH_SERVICES.map((service) => (
            <li key={service}>{service}</li>
          ))}
        </ul>
      </div>

      <p className='pcb-card__incharge'>
        You can contact our clinic incharge on <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>.
      </p>
      <p className='pcb-card__grievance'>
        For grievances or concerns, contact head office on{' '}
        <a href={`tel:${HEAD_OFFICE_PHONE}`}>{HEAD_OFFICE_PHONE}</a> or email{' '}
        <a href={`mailto:${HEAD_OFFICE_EMAIL}`}>{HEAD_OFFICE_EMAIL}</a>.
      </p>
    </section>
  );
}
