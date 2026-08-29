import {
  BadgeCheck,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  Home,
  Video
} from 'lucide-react';
import {
  avatarColorFromName,
  displayInitials,
  resolveProfilePhotoUrl
} from '../../lib/avatarDisplay';
import { formatPatientAvailability } from '../../lib/doctorSchedule';
import { isHomeCareOpinionRequest } from '../../lib/homeCareServices';
import {
  canJoinConsultationMeeting,
  isRecommendationOpinionRequest,
  patientRequestStatusLabel,
  patientRequestTitle
} from '../../lib/opinionRequests';
import type { OpinionRequest } from '../../types/opinionRequest';

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

function statusAccentClass(request: OpinionRequest, listVariant: 'upcoming' | 'completed'): string {
  if (listVariant === 'completed') {
    return 'pmr-card__accent pmr-card__accent--success';
  }
  const stage = request.consultation_stage;
  if (stage === 'payment_pending' || stage === 'recommended' || stage === 'schedule_proposed') {
    return 'pmr-card__accent pmr-card__accent--warn';
  }
  return 'pmr-card__accent pmr-card__accent--active';
}

function statusPillClass(request: OpinionRequest, listVariant: 'upcoming' | 'completed'): string {
  if (listVariant === 'completed') {
    return 'pmr-pill pmr-pill--status pmr-pill--status-success';
  }
  const stage = request.consultation_stage;
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
  listVariant: 'upcoming' | 'completed';
  onOpen: (requestId: string) => void;
};

export default function PatientRequestListCard({
  request,
  relativeTime,
  listVariant,
  onOpen
}: PatientRequestListCardProps) {
  const preferredTime = formatPreferredTimeDisplay(request);
  const paymentDate = formatPaymentDate(request);
  const paymentAmount = formatPaymentAmount(request);
  const isPaid = request.payment_status === 'paid';
  const statusLabel = patientRequestStatusLabel(request);
  const isHomeCare = isHomeCareOpinionRequest(request);
  const awaitingRecommendation = isRecommendationOpinionRequest(request) && !request.doctor_name;
  const doctorName = patientRequestTitle(request);
  const specialtyLine = isHomeCare
    ? 'Clinic home care coordination'
    : request.requested_specialty ??
      request.doctor_specialty ??
      (awaitingRecommendation ? 'Our care team will recommend specialists' : null);
  const showAppointmentBadge = !isHomeCare && isAppointmentScheduled(request);
  const showStatusPill =
    listVariant === 'completed' ||
    !showAppointmentBadge ||
    !['Appointment scheduled', 'Ready for consultation', 'Consultation complete'].includes(statusLabel);

  const meetingLink = request.meeting_link?.trim() || null;
  const scheduledAt = request.scheduled_at?.trim() || null;
  const canJoinMeeting =
    listVariant === 'upcoming' &&
    !isHomeCare &&
    isPaid &&
    canJoinConsultationMeeting(request);

  const doctorPhotoUrl = resolveProfilePhotoUrl(request.doctor_image_url);
  const doctorInitials = displayInitials(doctorName);
  const doctorAvatarBg = avatarColorFromName(doctorName);

  return (
    <li className={`pmr-card pmr-card--${listVariant}${canJoinMeeting ? ' pmr-card--has-meeting' : ''}`}>
      <article className='pmr-card__shell'>
        <span className={statusAccentClass(request, listVariant)} aria-hidden />
        <div className='pmr-card__body'>
          <button
            type='button'
            className='pmr-card__button'
            onClick={() => onOpen(request.id)}
            aria-label={`View request for ${doctorName}, ${statusLabel}`}
          >
            <div className='pmr-card__inner'>
              <div className='pmr-card__top'>
                {isHomeCare ? (
                  <span className='pmr-card__avatar pmr-card__avatar--home' aria-hidden>
                    <Home size={20} strokeWidth={2} />
                  </span>
                ) : doctorPhotoUrl ? (
                  <img
                    src={doctorPhotoUrl}
                    alt={doctorName}
                    className='pmr-card__avatar pmr-card__avatar-photo'
                    width={52}
                    height={52}
                  />
                ) : (
                  <span
                    className='pmr-card__avatar pmr-card__avatar--initials'
                    style={{ background: doctorAvatarBg }}
                    aria-hidden
                  >
                    {doctorInitials}
                  </span>
                )}
                <div className='pmr-card__identity'>
                  <h4 className='pmr-card__name'>{doctorName}</h4>
                  {specialtyLine ? <p className='pmr-card__specialty'>{specialtyLine}</p> : null}
                </div>
                <ChevronRight size={18} className='pmr-card__chevron' aria-hidden />
              </div>

              <div className='pmr-card__badges'>
                {isHomeCare &&
                (request.home_care_followup_date || request.home_care_remarks?.trim()) ? (
                  <span className='pmr-pill pmr-pill--verified'>
                    <Clock size={12} strokeWidth={2.25} aria-hidden />
                    {request.home_care_followup_date
                      ? `Follow-up ${new Date(`${request.home_care_followup_date}T00:00:00`).toLocaleDateString()}`
                      : 'Clinic update'}
                  </span>
                ) : null}
                {listVariant === 'upcoming' && isPaid ? (
                  <span className='pmr-pill pmr-pill--paid'>
                    <CreditCard size={12} strokeWidth={2.25} aria-hidden />
                    Payment confirmed
                  </span>
                ) : null}
                {listVariant === 'upcoming' && showAppointmentBadge ? (
                  <span className='pmr-pill pmr-pill--appointment'>
                    <Calendar size={12} strokeWidth={2.25} aria-hidden />
                    Appointment scheduled
                  </span>
                ) : null}
                {showStatusPill ? (
                  <span className={statusPillClass(request, listVariant)}>
                    {listVariant === 'completed' ? 'Completed' : statusLabel}
                  </span>
                ) : null}
              </div>

              {listVariant === 'upcoming' && isPaid && (paymentDate || paymentAmount) ? (
                <div className='pmr-card__payment-panel'>
                  <Calendar size={14} className='pmr-card__payment-icon' aria-hidden />
                  <div className='pmr-card__payment-main'>
                    <span className='pmr-card__payment-label'>Payment</span>
                    {paymentDate ? <span className='pmr-card__payment-date'>{paymentDate}</span> : null}
                  </div>
                  <div className='pmr-card__payment-side'>
                    {paymentAmount ? (
                      <span className='pmr-card__payment-amount'>{paymentAmount}</span>
                    ) : null}
                    <span className='pmr-card__payment-status'>
                      <span>Paid</span>
                      <BadgeCheck size={12} strokeWidth={2.5} aria-hidden />
                    </span>
                  </div>
                </div>
              ) : null}

              {listVariant === 'upcoming' && preferredTime && !isPaid ? (
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

              {listVariant === 'upcoming' && preferredTime && isPaid ? (
                <p className='pmr-card__preferred-hint'>
                  <Calendar size={13} aria-hidden />
                  Preferred: {preferredTime}
                </p>
              ) : null}

              {listVariant === 'completed' && scheduledAt ? (
                <p className='pmr-card__completed-meta'>
                  <Calendar size={13} aria-hidden />
                  {new Date(scheduledAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              ) : null}
            </div>
          </button>

          {canJoinMeeting && meetingLink ? (
            <div className='pmr-card__meeting' role='region' aria-label='Video consultation'>
              <div className='pmr-card__meeting-copy'>
                <p className='pmr-card__meeting-label'>
                  <Video size={15} aria-hidden /> Video consultation
                </p>
                {scheduledAt ? (
                  <p className='pmr-card__meeting-when'>
                    {new Date(scheduledAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </p>
                ) : null}
              </div>
              <a href={meetingLink} target='_blank' rel='noreferrer' className='pmr-card__join'>
                Join meeting
              </a>
            </div>
          ) : null}

          <button
            type='button'
            className='pmr-card__footer'
            onClick={() => onOpen(request.id)}
            aria-label={`View details for ${doctorName}`}
          >
            <span className='pmr-card__updated'>
              <Clock size={13} aria-hidden />
              Updated {relativeTime}
            </span>
            <span className='pmr-card__view-details'>
              View details
              <ChevronRight size={13} aria-hidden />
            </span>
          </button>
        </div>
      </article>
    </li>
  );
}
