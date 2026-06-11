import { Calendar, ChevronRight, CircleDollarSign, Stethoscope } from 'lucide-react';
import '../OpinionRequests/patient-my-requests.css';
import type { OpinionRequest } from '../../types/opinionRequest';
import { normalizeConsultationCurrency } from '../../lib/consultationCurrency';
import { formatConsultationTierLabel } from '../../lib/consultationTiers';
import { formatPatientAvailability } from '../../lib/doctorSchedule';
import { patientRequestStatusLabel } from '../../lib/opinionRequests';
import {
  isPatientAppointmentPhase,
  isPaymentAccessible,
  isScheduleConfirmed
} from '../../lib/consultationWizard';
import PatientPaymentProofUpload from './PatientPaymentProofUpload';

export type PatientConsultationRetainVariant = 'full' | 'doctor' | 'payment';

type PatientConsultationRetainCardProps = {
  request: OpinionRequest;
  variant?: PatientConsultationRetainVariant;
  onOpen?: (requestId: string) => void;
  onPaymentProofSubmitted?: () => void;
  onMessage?: (message: string, type: 'error' | 'success') => void;
};

export function hasRetainedDoctorSelection(request: OpinionRequest): boolean {
  return Boolean(request.doctor_name || request.selected_doctor_id);
}

export function hasRetainedPaymentDetails(request: OpinionRequest): boolean {
  return isPaymentAccessible(request);
}

export function hasRetainedConsultationDetails(request: OpinionRequest): boolean {
  const preferredTime = formatPatientAvailability(request.patient_availability);
  return Boolean(
    request.selected_doctor_id ||
    preferredTime ||
    isScheduleConfirmed(request) ||
    isPatientAppointmentPhase(request) ||
    request.payment_status === 'paid'
  );
}

function doctorInitials(name: string | null | undefined): string {
  if (!name?.trim()) return 'DR';
  const cleaned = name.replace(/^Dr\.?\s*/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? 'DR').toUpperCase();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatPreferredTimeDisplay(request: OpinionRequest): string | null {
  const formatted = formatPatientAvailability(request.patient_availability);
  if (!formatted) return null;
  const firstLine = formatted.split('\n')[0]?.trim();
  if (!firstLine) return null;

  const parsed = new Date(firstLine);
  if (!Number.isNaN(parsed.getTime()) && /[\d/:-]/.test(firstLine)) {
    return formatDateTime(firstLine);
  }
  return firstLine;
}

function formatPaymentLine(request: OpinionRequest): string | null {
  if (request.payment_status !== 'paid') return null;
  const parts: string[] = [];
  if (request.payment_confirmed_at) {
    parts.push(formatDateTime(request.payment_confirmed_at));
  }
  if (request.payment_amount != null) {
    parts.push(`${request.payment_amount} ${request.payment_currency ?? 'USD'}`);
  }
  if (request.payment_reference) {
    parts.push(`Ref. ${request.payment_reference}`);
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

export default function PatientConsultationRetainCard({
  request,
  variant = 'full',
  onOpen,
  onPaymentProofSubmitted,
  onMessage
}: PatientConsultationRetainCardProps) {
  const preferredTime = formatPreferredTimeDisplay(request);
  const showDoctor = hasRetainedDoctorSelection(request);
  const isPaid = request.payment_status === 'paid';
  const showPayment = hasRetainedPaymentDetails(request);
  const paymentLine = formatPaymentLine(request);
  const confirmedAppointment =
    variant === 'full' && request.scheduled_at && isPatientAppointmentPhase(request)
      ? formatDateTime(request.scheduled_at)
      : null;

  if (variant === 'doctor' && !showDoctor) return null;
  if (variant === 'payment' && !showPayment) return null;
  if (variant === 'full' && !hasRetainedConsultationDetails(request)) return null;

  const showDoctorBlock = showDoctor && (variant === 'full' || variant === 'doctor');
  const showPreferredTime = preferredTime && (variant === 'full' || variant === 'doctor');
  const showPaymentBlock = showPayment && (variant === 'full' || variant === 'payment');
  const showStatusBadge = variant === 'full';
  const isInteractive = Boolean(onOpen);

  const doctorName = request.doctor_name ?? 'Doctor';
  const specialtyLine = request.doctor_specialty ?? null;
  const statusLabel = patientRequestStatusLabel(request);

  const ariaLabel =
    variant === 'doctor'
      ? 'Selected doctor'
      : variant === 'payment'
        ? 'Payment details'
        : 'Your consultation details';

  const consultationFeeLine =
    request.consultation_duration_minutes && request.consultation_fee_usd != null
      ? formatConsultationTierLabel(
          {
            duration_minutes: request.consultation_duration_minutes,
            fee_usd: request.consultation_fee_usd
          },
          { currency: normalizeConsultationCurrency(request.consultation_currency) }
        )
      : null;

  const details =
    showPreferredTime ||
    confirmedAppointment ||
    consultationFeeLine ||
    (showPaymentBlock && paymentLine) ? (
      <ul className='pmr-card__details patient-consultation-retain__details'>
        {consultationFeeLine ? (
          <li className='pmr-detail'>
            <CircleDollarSign size={15} className='pmr-detail__icon' aria-hidden />
            <span>
              <span className='pmr-detail__label'>Consultation fee</span>
              <span className='pmr-detail__value'>{consultationFeeLine}</span>
            </span>
          </li>
        ) : null}
        {showPreferredTime ? (
          <li className='pmr-detail'>
            <Calendar size={15} className='pmr-detail__icon' aria-hidden />
            <span>
              <span className='pmr-detail__label'>Preferred time</span>
              <span className='pmr-detail__value'>{preferredTime}</span>
            </span>
          </li>
        ) : null}
        {confirmedAppointment ? (
          <li className='pmr-detail'>
            <Calendar size={15} className='pmr-detail__icon' aria-hidden />
            <span>
              <span className='pmr-detail__label'>Confirmed appointment</span>
              <span className='pmr-detail__value'>{confirmedAppointment}</span>
            </span>
          </li>
        ) : null}
        {showPaymentBlock && paymentLine ? (
          <li className='pmr-detail'>
            <CircleDollarSign size={15} className='pmr-detail__icon' aria-hidden />
            <span>
              <span className='pmr-detail__label'>Payment</span>
              <span className='pmr-detail__value'>{paymentLine}</span>
            </span>
          </li>
        ) : null}
      </ul>
    ) : null;

  const paymentActions =
    showPaymentBlock && !isPaid ? (
      <div className='patient-consultation-retain__actions'>
        <p className='patient-consultation-retain__hint'>Payment required before your visit.</p>
        {request.payment_amount != null ? (
          <p className='patient-consultation-retain__amount'>
            <span className='patient-consultation-retain__amount-label'>Amount due</span>
            <strong>
              {request.payment_amount} {request.payment_currency ?? 'USD'}
            </strong>
          </p>
        ) : null}
        {request.payment_link ? (
          <>
            <a
              href={request.payment_link}
              target='_blank'
              rel='noreferrer'
              className='primary-btn patient-consultation-retain__pay-link'
            >
              Pay now
            </a>
            <PatientPaymentProofUpload
              request={request}
              onSubmitted={onPaymentProofSubmitted}
              onMessage={onMessage}
            />
          </>
        ) : (
          <p className='patient-consultation-retain__hint'>Payment link coming soon.</p>
        )}
      </div>
    ) : null;

  const badges =
    showStatusBadge || (showPaymentBlock && isPaid) ? (
      <div className='pmr-card__badges'>
        {showPaymentBlock && isPaid ? (
          <span className='pmr-pill pmr-pill--paid'>Payment confirmed</span>
        ) : null}
        {showStatusBadge ? <span className={statusPillClass(request)}>{statusLabel}</span> : null}
      </div>
    ) : null;

  const topRow = showDoctorBlock ? (
    <div className='pmr-card__top'>
      <span className='pmr-card__avatar' aria-hidden>
        {doctorInitials(request.doctor_name)}
      </span>
      <div className='pmr-card__identity'>
        <p className='pmr-card__name'>{doctorName}</p>
        {specialtyLine ? <p className='pmr-card__specialty'>{specialtyLine}</p> : null}
      </div>
      {isInteractive ? <ChevronRight size={20} className='pmr-card__chevron' aria-hidden /> : null}
    </div>
  ) : showPaymentBlock && variant === 'payment' ? (
    <div className='pmr-card__top patient-consultation-retain__top--payment'>
      <span className='pmr-card__avatar patient-consultation-retain__avatar--payment' aria-hidden>
        <CircleDollarSign size={18} strokeWidth={2} />
      </span>
      <div className='pmr-card__identity'>
        <p className='pmr-card__name'>Payment</p>
        <p className='pmr-card__specialty'>
          {isPaid ? 'Confirmed for your visit' : 'Complete before your consultation'}
        </p>
      </div>
    </div>
  ) : null;

  const content = (
    <>
      {topRow}
      {badges}
      {details}
      {paymentActions}
      {isInteractive ? (
        <footer className='pmr-card__footer patient-consultation-retain__footer'>
          <span className='patient-consultation-retain__cta'>
            <Stethoscope size={14} aria-hidden />
            View consultation
          </span>
        </footer>
      ) : null}
    </>
  );

  if (isInteractive) {
    return (
      <article className='patient-consultation-retain patient-consultation-retain--card'>
        <button
          type='button'
          className='pmr-card__button'
          onClick={() => onOpen!(request.id)}
          aria-label={`${ariaLabel}: ${doctorName}, ${statusLabel}`}
        >
          {content}
        </button>
      </article>
    );
  }

  return (
    <aside
      className='patient-consultation-retain patient-consultation-retain--inline'
      aria-label={ariaLabel}
    >
      {content}
    </aside>
  );
}
