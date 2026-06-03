import type { OpinionRequest } from '../../types/opinionRequest';
import { formatPatientAvailability } from '../../lib/doctorSchedule';
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

export default function PatientConsultationRetainCard({
  request,
  variant = 'full',
  onPaymentProofSubmitted,
  onMessage
}: PatientConsultationRetainCardProps) {
  const preferredTime = formatPatientAvailability(request.patient_availability);
  const showDoctor = hasRetainedDoctorSelection(request);
  const isPaid = request.payment_status === 'paid';
  const showPayment = hasRetainedPaymentDetails(request);

  if (variant === 'doctor' && !showDoctor) return null;
  if (variant === 'payment' && !showPayment) return null;
  if (variant === 'full' && !hasRetainedConsultationDetails(request)) return null;

  const showDoctorBlock = showDoctor && (variant === 'full' || variant === 'doctor');
  const showPreferredTime = preferredTime && (variant === 'full' || variant === 'doctor');
  const showConfirmedAppointment =
    variant === 'full' && request.scheduled_at && isPatientAppointmentPhase(request);
  const showPaymentBlock = showPayment && (variant === 'full' || variant === 'payment');

  const ariaLabel =
    variant === 'doctor'
      ? 'Selected doctor'
      : variant === 'payment'
        ? 'Payment details'
        : 'Your consultation details';

  return (
    <aside className='patient-consultation-retain' aria-label={ariaLabel}>
      <p className='patient-consultation-retain__heading'>Your consultation</p>

      {showDoctorBlock ? (
        <div className='patient-consultation-retain__block'>
          <span className='patient-selection-summary__label'>Selected doctor</span>
          <p className='patient-consultation-retain__value'>
            <strong>{request.doctor_name ?? 'Doctor'}</strong>
            {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
          </p>
        </div>
      ) : null}

      {showPreferredTime ? (
        <div className='patient-consultation-retain__block'>
          <span className='patient-selection-summary__label'>Preferred time</span>
          <p className='patient-consultation-retain__value' style={{ whiteSpace: 'pre-wrap' }}>
            {preferredTime}
          </p>
        </div>
      ) : null}

      {showConfirmedAppointment ? (
        <div className='patient-consultation-retain__block'>
          <span className='patient-selection-summary__label'>Confirmed appointment</span>
          <p className='patient-consultation-retain__value'>
            {new Date(request.scheduled_at!).toLocaleString()}
          </p>
        </div>
      ) : null}

      {showPaymentBlock ? (
        <div
          className={`patient-consultation-retain__block patient-consultation-retain__payment${
            isPaid ? ' patient-consultation-retain__payment--confirmed' : ''
          }`}
        >
          <span className='patient-selection-summary__label'>Payment</span>
          {isPaid ? (
            <>
              <p className='patient-consultation-retain__badge'>Confirmed</p>
              {request.payment_confirmed_at ? (
                <p className='patient-consultation-retain__value'>
                  {new Date(request.payment_confirmed_at).toLocaleString()}
                </p>
              ) : null}
              {request.payment_amount != null ? (
                <p className='patient-consultation-retain__value'>
                  {request.payment_amount} {request.payment_currency ?? 'USD'}
                </p>
              ) : null}
              {request.payment_reference ? (
                <p className='patient-consultation-retain__meta'>
                  Reference: {request.payment_reference}
                </p>
              ) : null}
            </>
          ) : request.payment_link ? (
            <>
              <p className='patient-consultation-retain__meta'>Payment required before your visit.</p>
              {request.payment_amount != null ? (
                <p className='patient-consultation-retain__value'>
                  Amount: {request.payment_amount} {request.payment_currency ?? 'USD'}
                </p>
              ) : null}
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
            <p className='patient-consultation-retain__meta'>Payment link coming soon.</p>
          )}
        </div>
      ) : null}
    </aside>
  );
}
