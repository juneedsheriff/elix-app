import {
  BadgeCheck,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  ShieldCheck
} from 'lucide-react';
import { formatPatientAvailability } from '../../lib/doctorSchedule';
import { isRecommendationOpinionRequest, patientRequestStatusLabel } from '../../lib/opinionRequests';
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

function formatPaymentDate(request: OpinionRequest): string | null {
  const iso = request.payment_confirmed_at ?? request.scheduled_at;
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatPaymentAmount(request: OpinionRequest): string | null {
  if (request.payment_amount == null) return null;
  const currency = (request.payment_currency ?? 'USD').toUpperCase();
  if (currency === 'INR') {
    return `₹${Number(request.payment_amount).toLocaleString()}`;
  }
  if (currency === 'USD') {
    return `$${Number(request.payment_amount).toLocaleString()}`;
  }
  return `${request.payment_amount} ${currency}`;
}

function isAppointmentScheduled(request: OpinionRequest): boolean {
  if (request.scheduled_at) return true;
  const stage = request.consultation_stage;
  return stage === 'scheduled' || stage === 'schedule_confirmed' || stage === 'paid' || stage === 'completed';
}

function statusAccentClass(request: OpinionRequest): string {
  const stage = request.consultation_stage;
  if (stage === 'paid' || stage === 'completed' || request.doctor_response?.trim()) {
    return 'pmr-card__accent pmr-card__accent--success';
  }
  if (
    stage === 'payment_pending' ||
    stage === 'recommended' ||
    stage === 'schedule_proposed'
  ) {
    return 'pmr-card__accent pmr-card__accent--warn';
  }
  return 'pmr-card__accent pmr-card__accent--active';
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
  const paymentDate = formatPaymentDate(request);
  const paymentAmount = formatPaymentAmount(request);
  const isPaid = request.payment_status === 'paid';
  const statusLabel = patientRequestStatusLabel(request);
  const awaitingRecommendation = isRecommendationOpinionRequest(request) && !request.doctor_name;
  const doctorName = awaitingRecommendation ? 'Doctor recommendations' : (request.doctor_name ?? 'Doctor');
  const specialtyLine =
    request.requested_specialty ??
    request.doctor_specialty ??
    (awaitingRecommendation ? 'Our care team will recommend specialists' : null);
  const showAppointmentBadge = isAppointmentScheduled(request);
  const showStatusPill =
    !showAppointmentBadge ||
    !['Appointment scheduled', 'Ready for consultation', 'Consultation complete'].includes(statusLabel);

  return (
    <li className='pmr-card'>
      <button
        type='button'
        className='pmr-card__button'
        onClick={() => onOpen(request.id)}
        aria-label={`View request for ${doctorName}, ${statusLabel}`}
      >
        <span className={statusAccentClass(request)} aria-hidden />
        <div className='pmr-card__inner'>
        <div className='pmr-card__top'>
          <span className='pmr-card__avatar' aria-hidden>
            {doctorInitials(request.doctor_name)}
          </span>
          <div className='pmr-card__identity'>
            <h4 className='pmr-card__name'>{doctorName}</h4>
            {specialtyLine ? <p className='pmr-card__specialty'>{specialtyLine}</p> : null}
          </div>
          <ChevronRight size={18} className='pmr-card__chevron' aria-hidden />
        </div>

        <div className='pmr-card__badges'>
          {request.records_verified_at ? (
            <span className='pmr-pill pmr-pill--verified'>
              <ShieldCheck size={12} strokeWidth={2.25} aria-hidden />
              Verified
            </span>
          ) : null}
          {isPaid ? (
            <span className='pmr-pill pmr-pill--paid'>
              <CreditCard size={12} strokeWidth={2.25} aria-hidden />
              Payment confirmed
            </span>
          ) : null}
          {showAppointmentBadge ? (
            <span className='pmr-pill pmr-pill--appointment'>
              <Calendar size={12} strokeWidth={2.25} aria-hidden />
              Appointment scheduled
            </span>
          ) : null}
          {showStatusPill ? <span className={statusPillClass(request)}>{statusLabel}</span> : null}
        </div>

        {isPaid && (paymentDate || paymentAmount) ? (
          <div className='pmr-card__payment-panel'>
            <Calendar size={14} className='pmr-card__payment-icon' aria-hidden />
            <div className='pmr-card__payment-main'>
              <span className='pmr-card__payment-label'>Payment</span>
              {paymentDate ? <span className='pmr-card__payment-date'>{paymentDate}</span> : null}
            </div>
            <div className='pmr-card__payment-side'>
              {paymentAmount ? <span className='pmr-card__payment-amount'>{paymentAmount}</span> : null}
              <span className='pmr-card__payment-status'>
                <span>Paid</span>
                <BadgeCheck size={12} strokeWidth={2.5} aria-hidden />
              </span>
            </div>
          </div>
        ) : null}

        {preferredTime && !isPaid ? (
          <ul className='pmr-card__details'>
            <li className='pmr-detail'>
              <Calendar size={15} className='pmr-detail__icon' aria-hidden />
              <span>
                <span className='pmr-detail__label'>Preferred time</span>
                <span className='pmr-detail__value'>{preferredTime}</span>
              </span>
            </li>
          </ul>
        ) : null}

        {preferredTime && isPaid ? (
          <p className='pmr-card__preferred-hint'>
            <Calendar size={13} aria-hidden />
            Preferred: {preferredTime}
          </p>
        ) : null}

        <footer className='pmr-card__footer'>
          <span className='pmr-card__updated'>
            <Clock size={13} aria-hidden />
            Updated {relativeTime}
          </span>
          <span className='pmr-card__view-details'>
            View details
            <ChevronRight size={13} aria-hidden />
          </span>
        </footer>
        </div>
      </button>
    </li>
  );
}
