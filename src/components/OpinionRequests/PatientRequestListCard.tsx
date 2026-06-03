import { Calendar, ChevronRight, CircleDollarSign, Clock } from 'lucide-react';
import { formatPatientAvailability } from '../../lib/doctorSchedule';
import { patientRequestStatusLabel } from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';

function doctorInitials(name: string | null | undefined): string {
  if (!name?.trim()) return 'DR';
  const cleaned = name.replace(/^Dr\.?\s*/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? 'DR').toUpperCase();
}

function formatPreferredTimeDisplay(request: OpinionRequest): string | null {
  const formatted = formatPatientAvailability(request.patient_availability);
  if (!formatted) return null;
  const firstLine = formatted.split('\n')[0]?.trim();
  if (!firstLine) return null;

  const parsed = new Date(firstLine);
  if (!Number.isNaN(parsed.getTime()) && /[\d/:-]/.test(firstLine)) {
    return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  return firstLine;
}

function formatPaymentDisplay(request: OpinionRequest): string | null {
  if (request.payment_status !== 'paid') return null;
  const parts: string[] = [];
  if (request.payment_confirmed_at) {
    parts.push(
      new Date(request.payment_confirmed_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    );
  }
  if (request.payment_amount != null) {
    parts.push(`${request.payment_amount} ${request.payment_currency ?? 'USD'}`);
  }
  return parts.length ? parts.join(' · ') : 'Confirmed';
}

function statusPillClass(request: OpinionRequest): string {
  const stage = request.consultation_stage;
  if (stage === 'paid' || stage === 'completed' || request.doctor_response?.trim()) {
    return 'pmr-pill pmr-pill--status pmr-pill--status-success';
  }
  if (
    stage === 'payment_pending' ||
    stage === 'recommended' ||
    stage === 'schedule_proposed'
  ) {
    return 'pmr-pill pmr-pill--status pmr-pill--status-warn';
  }
  return 'pmr-pill pmr-pill--status';
}

type PatientRequestListCardProps = {
  request: OpinionRequest;
  relativeTime: string;
  onOpen: (requestId: string) => void;
};

export default function PatientRequestListCard({
  request,
  relativeTime,
  onOpen
}: PatientRequestListCardProps) {
  const preferredTime = formatPreferredTimeDisplay(request);
  const paymentLine = formatPaymentDisplay(request);
  const statusLabel = patientRequestStatusLabel(request);
  const doctorName = request.doctor_name ?? 'Doctor';

  return (
    <li className='pmr-card'>
      <button
        type='button'
        className='pmr-card__button'
        onClick={() => onOpen(request.id)}
        aria-label={`View request for ${doctorName}, ${statusLabel}`}
      >
        <div className='pmr-card__top'>
          <span className='pmr-card__avatar' aria-hidden>
            {doctorInitials(request.doctor_name)}
          </span>
          <div className='pmr-card__identity'>
            <h4 className='pmr-card__name'>{doctorName}</h4>
            {request.doctor_specialty ? (
              <p className='pmr-card__specialty'>{request.doctor_specialty}</p>
            ) : null}
          </div>
          <ChevronRight size={20} className='pmr-card__chevron' aria-hidden />
        </div>

        <div className='pmr-card__badges'>
          {request.records_verified_at ? (
            <span className='pmr-pill pmr-pill--verified'>Verified</span>
          ) : null}
          {request.payment_status === 'paid' ? (
            <span className='pmr-pill pmr-pill--paid'>Payment confirmed</span>
          ) : null}
          <span className={statusPillClass(request)}>{statusLabel}</span>
        </div>

        {preferredTime || paymentLine ? (
          <ul className='pmr-card__details'>
            {preferredTime ? (
              <li className='pmr-detail'>
                <Calendar size={15} className='pmr-detail__icon' aria-hidden />
                <span>
                  <span className='pmr-detail__label'>Preferred time</span>
                  <span className='pmr-detail__value'>{preferredTime}</span>
                </span>
              </li>
            ) : null}
            {paymentLine ? (
              <li className='pmr-detail'>
                <CircleDollarSign size={15} className='pmr-detail__icon' aria-hidden />
                <span>
                  <span className='pmr-detail__label'>Payment</span>
                  <span className='pmr-detail__value'>{paymentLine}</span>
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}

        <footer className='pmr-card__footer'>
          <span className='pmr-card__updated'>
            <Clock size={14} aria-hidden />
            Updated {relativeTime}
          </span>
        </footer>
      </button>
    </li>
  );
}
