import { ArrowLeft, History } from 'lucide-react';
import OpinionRequestActivityTimeline from './OpinionRequestActivityTimeline';
import './patient-my-requests.css';

type OpinionRequestActivityPageProps = {
  requestId: string;
  requestLabel?: string | null;
  onBack: () => void;
  backLabel?: string;
  subtitle?: string;
  refreshKey?: number;
  variant?: 'patient' | 'staff';
};

export default function OpinionRequestActivityPage({
  requestId,
  requestLabel,
  onBack,
  backLabel = 'Back to request',
  subtitle = 'Actions by you, your care team, and your doctor on this request.',
  refreshKey,
  variant = 'patient'
}: OpinionRequestActivityPageProps) {
  const rootClass =
    variant === 'staff' ? 'pmr-audit-page pmr-audit-page--staff' : 'pmr-audit-page screen-grid doctors-screen';

  return (
    <div className={rootClass}>
      <section className='section-card pmr-audit-page__card'>
        <button type='button' className='text-btn patient-request-back' onClick={onBack}>
          <ArrowLeft size={18} aria-hidden /> {backLabel}
        </button>

        <header className='pmr-audit-page__head'>
          <span className='pmr-audit-page__icon' aria-hidden>
            <History size={22} strokeWidth={1.75} />
          </span>
          <div className='pmr-audit-page__head-text'>
            <h1 className='pmr-audit-page__title'>Activity history</h1>
            {requestLabel ? <p className='pmr-audit-page__request'>{requestLabel}</p> : null}
            <p className='pmr-audit-page__subtitle'>{subtitle}</p>
          </div>
        </header>

        <div className='pmr-audit-page__body'>
          <OpinionRequestActivityTimeline requestId={requestId} refreshKey={refreshKey} />
        </div>
      </section>
    </div>
  );
}
