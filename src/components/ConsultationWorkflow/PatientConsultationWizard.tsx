import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Link2,
  Lock,
  ShieldCheck,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  canPatientNavigateToStep,
  areDoctorsSharedWithPatient,
  getInitialPatientWizardStep,
  getMaxCompletedStepIndex,
  getSuggestedActiveStep,
  getWizardSteps,
  hasConsultationSummary,
  hasPatientPaymentDue,
  isAwaitingPseAvailabilityForSelfSelectedDoctor,
  isPatientPaymentLinkPending,
  isPatientAppointmentPhase,
  isPatientPaymentConfirmed,
  isPaymentAccessible,
  PATIENT_WIZARD_STEPS,
  resolveWizardStepOnUpdate,
  writePatientWizardStoredStep,
  type WizardProgressContext
} from '../../lib/consultationWizard';
import ConsultationSummaryPdfView from './ConsultationSummaryPdfView';
import PatientRequestRecordsModal from './PatientRequestRecordsModal';
import PatientPaymentProofUpload from './PatientPaymentProofUpload';
import PatientConsultationRetainCard, {
  hasRetainedDoctorSelection,
  hasRetainedPaymentDetails
} from './PatientConsultationRetainCard';
import {
  fetchConsultationSummary,
  fetchOpinionRequestRecommendations,
  patientConfirmSchedule,
  patientSelectDoctorWithAvailability,
  patientSubmitAvailability,
  subscribeOpinionRequestLiveUpdates
} from '../../lib/opinionRequests';
import {
  buildPatientAvailabilityPayload,
  formatPatientAvailability,
  toDatetimeLocalInputValue
} from '../../lib/doctorSchedule';
import type { ConsultationSummary, OpinionRequest, OpinionRequestRecommendation } from '../../types/opinionRequest';
import './consultation-wizard.css';

type PatientConsultationWizardProps = {
  request: OpinionRequest;
  onUpdated: () => void;
  onMessage: (message: string, type: 'error' | 'success') => void;
  onOpenRecord: (storagePath: string) => void;
  /** Bumped when the parent silently reloads request rows from the server. */
  liveTick?: number;
};

const PATIENT_STEP_ICONS: LucideIcon[] = [
  ClipboardList,
  FileText,
  Users,
  CreditCard,
  Calendar,
  FileText
];

function formatAppointmentDisplay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
  return `${day} • ${time}`;
}

function downloadAppointmentIcs(input: {
  scheduledAt: string;
  title: string;
  meetingLink?: string | null;
}) {
  const start = new Date(input.scheduledAt);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const toIcsUtc = (value: Date) =>
    value.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,');
  const description = input.meetingLink
    ? `Meeting link: ${input.meetingLink}`
    : 'Elix Health consultation';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Elix Health//Consultation//EN',
    'BEGIN:VEVENT',
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escape(input.title)}`,
    `DESCRIPTION:${escape(description)}`,
    input.meetingLink ? `URL:${input.meetingLink}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'consultation.ics';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PatientConsultationWizard({
  request,
  onUpdated,
  onMessage,
  onOpenRecord,
  liveTick = 0
}: PatientConsultationWizardProps) {
  const initialProgressCtx: WizardProgressContext = useMemo(
    () => ({
      request,
      recommendationsCount: 0,
      hasSummary: false
    }),
    [request]
  );
  const [expandedStep, setExpandedStep] = useState<number | null>(() =>
    getInitialPatientWizardStep(initialProgressCtx)
  );
  const stepStateRef = useRef<{ requestId: string | null; step: number | null; lastSuggested: number }>({
    requestId: request.id,
    step: getInitialPatientWizardStep(initialProgressCtx),
    lastSuggested: getSuggestedActiveStep(initialProgressCtx, 'patient')
  });
  const [recommendations, setRecommendations] = useState<OpinionRequestRecommendation[]>([]);
  const [summary, setSummary] = useState<ConsultationSummary | null>(null);
  const [pickingDoctorId, setPickingDoctorId] = useState<string | null>(null);
  const [preferredAt, setPreferredAt] = useState('');
  const [availabilityNotes, setAvailabilityNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);

  const loadExtras = useCallback(async () => {
    const [recRes, summaryRes] = await Promise.all([
      fetchOpinionRequestRecommendations(request.id),
      fetchConsultationSummary(request.id)
    ]);
    if (!recRes.error) setRecommendations(recRes.data ?? []);
    if (!summaryRes.error) setSummary(summaryRes.data);
    const raw = request.patient_availability;
    if (raw && typeof raw === 'object' && raw !== null) {
      const payload = raw as { preferred_at?: string; notes?: string };
      if (typeof payload.preferred_at === 'string') {
        setPreferredAt(toDatetimeLocalInputValue(payload.preferred_at));
      }
      if (typeof payload.notes === 'string') setAvailabilityNotes(payload.notes);
    }
    if (request.selected_doctor_id) {
      setPickingDoctorId(request.selected_doctor_id);
    }
  }, [request.id, request.patient_availability, request.selected_doctor_id]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras, liveTick]);

  useEffect(() => {
    return subscribeOpinionRequestLiveUpdates(request.id, () => {
      void loadExtras();
      onUpdated();
    });
  }, [request.id, loadExtras, onUpdated]);

  const progressCtx: WizardProgressContext = useMemo(
    () => ({
      request,
      recommendationsCount: recommendations.length,
      hasSummary: hasConsultationSummary(summary)
    }),
    [request, recommendations.length, summary]
  );

  const suggestedStep = useMemo(() => getSuggestedActiveStep(progressCtx, 'patient'), [progressCtx]);
  const maxNavigableStep = useMemo(
    () => getMaxCompletedStepIndex(progressCtx, 'patient') + 1,
    [progressCtx]
  );
  const wizardSteps = getWizardSteps('patient', progressCtx, expandedStep ?? suggestedStep);
  const onAppointmentStep = isPatientAppointmentPhase(request);
  const doctorsShared = areDoctorsSharedWithPatient(request, recommendations.length);
  const documentsVerified = Boolean(request.records_verified_at) || doctorsShared;

  useEffect(() => {
    const next = resolveWizardStepOnUpdate(request.id, suggestedStep, stepStateRef.current, {
      audience: 'patient',
      maxNavigableStep,
      progressCtx
    });
    stepStateRef.current = next;
    setExpandedStep(next.step);
  }, [request.id, suggestedStep, maxNavigableStep, progressCtx]);

  const setExpandedStepTracked = (step: number | null) => {
    if (step !== null) writePatientWizardStoredStep(request.id, step);
    stepStateRef.current = { ...stepStateRef.current, step };
    setExpandedStep(step);
  };

  const toggleStep = (index: number) => {
    if (!canPatientNavigateToStep(index, progressCtx)) return;
    setExpandedStepTracked(expandedStep === index ? null : index);
  };

  const goToStep = (index: number) => {
    if (!canPatientNavigateToStep(index, progressCtx)) return;
    setExpandedStepTracked(index);
  };

  const pickingDoctor = useMemo(
    () => recommendations.find((rec) => rec.doctor_id === pickingDoctorId) ?? null,
    [recommendations, pickingDoctorId]
  );

  const submitDoctorAndAvailability = async () => {
    if (!pickingDoctorId) {
      onMessage('Select a doctor first.', 'error');
      return;
    }
    if (!preferredAt.trim()) {
      onMessage('Choose your preferred appointment date and time.', 'error');
      return;
    }
    const payload = buildPatientAvailabilityPayload({
      preferredAt: preferredAt,
      notes: availabilityNotes
    });
    setBusy(true);
    const { error } = await patientSelectDoctorWithAvailability(request.id, pickingDoctorId, payload);
    setBusy(false);
    if (error) {
      onMessage(error.message, 'error');
      return;
    }
    onMessage('Your doctor and preferred time were sent to our team for confirmation.', 'success');
    onUpdated();
  };

  const submitAvailabilityOnly = async () => {
    if (!preferredAt.trim()) {
      onMessage('Choose your preferred appointment date and time.', 'error');
      return;
    }
    const payload = buildPatientAvailabilityPayload({
      preferredAt: preferredAt,
      notes: availabilityNotes
    });
    setBusy(true);
    const { error } = await patientSubmitAvailability(request.id, payload);
    setBusy(false);
    if (error) {
      onMessage(error.message, 'error');
      return;
    }
    onMessage('Preferred time updated. Our team will confirm your appointment.', 'success');
    onUpdated();
  };

  const awaitingDoctorChoice =
    recommendations.length > 0 &&
    request.consultation_stage !== 'doctor_selected' &&
    request.consultation_stage !== 'availability_submitted' &&
    request.consultation_stage !== 'schedule_proposed' &&
    request.consultation_stage !== 'schedule_confirmed' &&
    request.consultation_stage !== 'scheduled' &&
    request.consultation_stage !== 'payment_pending' &&
    request.consultation_stage !== 'paid' &&
    request.consultation_stage !== 'completed';

  const confirmSchedule = async () => {
    setBusy(true);
    const { error } = await patientConfirmSchedule(request.id);
    setBusy(false);
    if (error) {
      onMessage(error.message, 'error');
      return;
    }
    onMessage('Schedule confirmed. Our team will send your payment link shortly.', 'success');
    onUpdated();
  };

  const awaitingSelfSelectAvailability = isAwaitingPseAvailabilityForSelfSelectedDoctor(
    request,
    recommendations.length
  );

  const waitingForDoctorList =
    !awaitingDoctorChoice &&
    !recommendations.length &&
    !awaitingSelfSelectAvailability &&
    request.consultation_stage === 'recommended';

  const renderPaymentRetain = () =>
    hasRetainedPaymentDetails(request) ? (
      <div className='patient-consultation-retain-step'>
        <PatientConsultationRetainCard
          request={request}
          variant='payment'
          onPaymentProofSubmitted={onUpdated}
          onMessage={onMessage}
        />
      </div>
    ) : null;

  const renderStepContent = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className='doctor-response-block patient-view'>
            <p className='muted'>
              Sent to {request.doctor_name ?? 'our care team'} on{' '}
              {new Date(request.created_at).toLocaleString()}.
            </p>
            <p>{request.message}</p>
          </div>
        );
      case 1:
        return (
          <div className='doctor-response-block patient-view patient-docs-verification'>
            {documentsVerified ? (
              <div className='patient-docs-verification__box'>
                {request.records_verified_at ? (
                  <span className='patient-docs-verified-badge'>Verified</span>
                ) : null}
                <p className='patient-docs-verification__text muted'>
                  {request.records_verified_at
                    ? `Your documents were verified on ${new Date(request.records_verified_at).toLocaleString()}.`
                    : 'Your documents have been verified.'}{' '}
                  {doctorsShared
                    ? 'Choose from the doctors recommended for you below.'
                    : awaitingSelfSelectAvailability
                      ? 'Our team is confirming availability with your selected doctor.'
                      : 'Our team will share doctor recommendations next.'}
                </p>
                {request.records.length > 0 || (!doctorsShared && suggestedStep > 1) ? (
                  <div className='patient-docs-verification__actions'>
                    {!doctorsShared && suggestedStep > 1 ? (
                      <button
                        type='button'
                        className='primary-btn patient-docs-verification__btn'
                        onClick={() => goToStep(suggestedStep)}
                      >
                        Continue →
                      </button>
                    ) : null}
                    {request.records.length > 0 ? (
                      <button
                        type='button'
                        className='secondary-btn patient-docs-verification__btn patient-view-documents-btn'
                        onClick={() => setDocumentsModalOpen(true)}
                      >
                        View documents ({request.records.length})
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <p className='muted doctor-awaiting-response'>
                  Our team is reviewing your uploaded documents ({request.records.length} file
                  {request.records.length === 1 ? '' : 's'}).
                </p>
                {request.records.length > 0 ? (
                  <div className='patient-docs-verification__actions'>
                    <button
                      type='button'
                      className='secondary-btn patient-docs-verification__btn patient-view-documents-btn'
                      onClick={() => setDocumentsModalOpen(true)}
                    >
                      View documents ({request.records.length})
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      case 2: {
        const submittedAvailability = formatPatientAvailability(request.patient_availability);
        const showPicker =
          awaitingDoctorChoice || request.consultation_stage === 'doctor_selected';
        const hasChosenDoctor =
          hasRetainedDoctorSelection(request) || Boolean(pickingDoctorId);
        const showSelectedDoctorSummary =
          (hasChosenDoctor || submittedAvailability || awaitingSelfSelectAvailability) &&
          (!waitingForDoctorList || awaitingSelfSelectAvailability);

        return (
          <div className='doctor-response-block patient-view'>
            {showSelectedDoctorSummary ? (
              <div className='patient-consultation-retain-step patient-consultation-retain-step--doctors'>
                <PatientConsultationRetainCard request={request} variant='doctor' />
                {awaitingSelfSelectAvailability ? (
                  <p className='muted doctor-awaiting-response' style={{ marginTop: '0.85rem' }}>
                    Our patient service team is confirming availability with{' '}
                    <strong>{request.doctor_name ?? 'your selected doctor'}</strong>. If they are
                    unavailable, we will share alternative specialists here for you to choose from.
                  </p>
                ) : null}
              </div>
            ) : null}
            {showPicker ? (
              <>
                {!hasChosenDoctor ? (
                  <p className='muted'>
                    Select a doctor and choose your preferred appointment date and time. Our team will
                    check the doctor&apos;s availability.
                  </p>
                ) : null}
                <ul className='list patient-doctor-choice-list'>
                  {recommendations.map((rec) => {
                    const isActive = pickingDoctorId === rec.doctor_id;
                    return (
                      <li
                        key={rec.id}
                        className={`patient-doctor-choice${isActive ? ' patient-doctor-choice--active' : ''}`}
                      >
                        <p className='patient-doctor-choice__name'>
                          <strong>{rec.doctor_name ?? 'Doctor'}</strong>
                          {rec.doctor_specialty ? ` · ${rec.doctor_specialty}` : ''}
                        </p>
                        {isActive ? (
                          <div className='patient-doctor-choice__schedule'>
                            <label className='patient-schedule-field'>
                              <span className='patient-schedule-field__label'>Preferred date &amp; time</span>
                              <input
                                type='datetime-local'
                                className='patient-schedule-field__input'
                                value={preferredAt}
                                onChange={(e) => setPreferredAt(e.target.value)}
                                disabled={busy}
                              />
                            </label>
                            <label className='patient-schedule-field'>
                              <span className='patient-schedule-field__label'>
                                Additional notes (optional)
                              </span>
                              <textarea
                                className='patient-availability-input'
                                placeholder='e.g. timezone, backup times, video vs in-person'
                                rows={2}
                                value={availabilityNotes}
                                onChange={(e) => setAvailabilityNotes(e.target.value)}
                                disabled={busy}
                              />
                            </label>
                          </div>
                        ) : (
                          <button
                            type='button'
                            className='secondary-btn patient-doctor-choice__btn'
                            disabled={busy}
                            onClick={() => setPickingDoctorId(rec.doctor_id)}
                          >
                            Select this doctor
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {pickingDoctor && preferredAt ? (
                  <div className='patient-selection-summary'>
                    <p className='patient-selection-summary__title'>Your selection</p>
                    <p className='patient-selection-summary__doctor'>
                      <strong>{pickingDoctor.doctor_name ?? request.doctor_name ?? 'Doctor'}</strong>
                      {pickingDoctor.doctor_specialty
                        ? ` · ${pickingDoctor.doctor_specialty}`
                        : request.doctor_specialty
                          ? ` · ${request.doctor_specialty}`
                          : ''}
                    </p>
                    <p className='patient-selection-summary__time'>
                      <span className='patient-selection-summary__label'>Preferred time</span>
                      {new Date(preferredAt).toLocaleString()}
                    </p>
                    {availabilityNotes.trim() ? (
                      <p className='patient-selection-summary__notes'>{availabilityNotes.trim()}</p>
                    ) : null}
                    <button
                      type='button'
                      className='primary-btn'
                      disabled={busy}
                      onClick={() =>
                        void (request.consultation_stage === 'doctor_selected'
                          ? submitAvailabilityOnly()
                          : submitDoctorAndAvailability())
                      }
                    >
                      Submit doctor &amp; preferred time
                    </button>
                  </div>
                ) : null}
              </>
            ) : waitingForDoctorList ? (
              <p className='muted doctor-awaiting-response'>Loading recommended doctors…</p>
            ) : awaitingSelfSelectAvailability ? null : hasChosenDoctor ? null : (
              <p className='muted'>Doctor recommendations will appear here once shared by our team.</p>
            )}

            {request.consultation_stage === 'schedule_proposed' ? (
              <div className='patient-schedule-proposal' style={{ marginTop: '1rem' }}>
                <h5>Proposed schedule</h5>
                {request.pse_scheduling_message ? (
                  <p className='muted' style={{ whiteSpace: 'pre-wrap' }}>
                    {request.pse_scheduling_message}
                  </p>
                ) : null}
                {request.scheduled_at ? (
                  <p>
                    <strong>Proposed time:</strong>{' '}
                    {new Date(request.scheduled_at).toLocaleString()}
                  </p>
                ) : null}
                <button
                  type='button'
                  className='primary-btn'
                  disabled={busy}
                  onClick={() => void confirmSchedule()}
                >
                  Confirm doctor &amp; schedule
                </button>
              </div>
            ) : null}
            {request.consultation_stage === 'schedule_confirmed' ? (
              <p className='muted' style={{ marginTop: '1rem' }}>
                You confirmed the schedule
                {request.schedule_confirmed_at
                  ? ` on ${new Date(request.schedule_confirmed_at).toLocaleString()}`
                  : ''}
                . Payment instructions will appear under Payment.
              </p>
            ) : null}
          </div>
        );
      }
      case 3:
        return (
          <div className='doctor-response-block patient-view'>
            {isPatientPaymentConfirmed(request) ? (
              <>
                {renderPaymentRetain()}
                <p className='muted'>
                  Payment confirmed. Appointment and meeting details are on{' '}
                  <button type='button' className='text-btn' onClick={() => goToStep(4)}>
                    Scheduled appointment
                  </button>
                  .
                </p>
              </>
            ) : hasPatientPaymentDue(request) ? (
              <div className='patient-payment-step'>
                {request.payment_amount != null ? (
                  <p className='patient-payment-step__amount'>
                    <span className='patient-payment-step__amount-label'>Amount due</span>
                    <strong>
                      {request.payment_amount} {request.payment_currency ?? 'USD'}
                    </strong>
                  </p>
                ) : null}
                <p className='muted patient-payment-step__hint'>
                  Complete payment to unlock your scheduled appointment and meeting link.
                </p>
                <a
                  href={request.payment_link!}
                  target='_blank'
                  rel='noreferrer'
                  className='primary-btn patient-payment-step__pay-btn'
                >
                  Pay now
                </a>
                <PatientPaymentProofUpload
                  request={request}
                  onSubmitted={onUpdated}
                  onMessage={onMessage}
                />
              </div>
            ) : isPatientPaymentLinkPending(request) ? (
              <div className='patient-payment-step'>
                {request.payment_amount != null ? (
                  <p className='patient-payment-step__amount'>
                    <span className='patient-payment-step__amount-label'>Amount due</span>
                    <strong>
                      {request.payment_amount} {request.payment_currency ?? 'USD'}
                    </strong>
                  </p>
                ) : null}
                <p className='muted doctor-awaiting-response'>
                  Your payment link was shared by our team. If Pay now does not appear below, refresh
                  this page.
                </p>
                <button type='button' className='secondary-btn' onClick={() => onUpdated()}>
                  Refresh payment details
                </button>
              </div>
            ) : isPaymentAccessible(request) ? (
              <p className='muted doctor-awaiting-response'>
                Our team is preparing your payment link. You will be able to pay here once it is
                shared.
              </p>
            ) : (
              <p className='muted doctor-awaiting-response'>
               Our team will share the payment instructions here. Once the payment is confirmed, the appointment will be scheduled with the doctor.
              </p>
            )}
          </div>
        );
      case 4:
        return (
          <div className='doctor-response-block patient-view patient-appointment-step'>
            {onAppointmentStep && request.scheduled_at && request.meeting_link ? (
              <div className='patient-appointment-detail-card'>
                {request.scheduled_at ? (
                  <div className='patient-appointment-detail-card__row'>
                    <span className='patient-appointment-detail-card__icon' aria-hidden>
                      <Calendar size={18} />
                    </span>
                    <div className='patient-appointment-detail-card__content'>
                      <span className='patient-appointment-detail-card__label'>Appointment date</span>
                      <p className='patient-appointment-detail-card__value'>
                        {formatAppointmentDisplay(request.scheduled_at)}
                      </p>
                    </div>
                  </div>
                ) : null}

                {request.meeting_link ? (
                  <div className='patient-appointment-detail-card__row'>
                    <span className='patient-appointment-detail-card__icon' aria-hidden>
                      <Link2 size={18} />
                    </span>
                    <div className='patient-appointment-detail-card__content'>
                      <span className='patient-appointment-detail-card__label'>Meeting link</span>
                      {request.payment_status === 'paid' ? (
                        <a
                          href={request.meeting_link}
                          target='_blank'
                          rel='noreferrer'
                          className='patient-appointment-detail-card__link'
                        >
                          {request.meeting_link}
                        </a>
                      ) : (
                        <p className='muted patient-appointment-detail-card__pending'>
                          Meeting link activates after payment is confirmed.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                {request.scheduled_at ? (
                  <button
                    type='button'
                    className='patient-appointment-detail-card__calendar-btn'
                    onClick={() =>
                      downloadAppointmentIcs({
                        scheduledAt: request.scheduled_at!,
                        title: `Consultation with ${request.doctor_name ?? 'your doctor'}`,
                        meetingLink: request.meeting_link
                      })
                    }
                  >
                    <CalendarPlus size={16} aria-hidden />
                    Add to calendar
                  </button>
                ) : null}

                {request.payment_status === 'paid' && request.meeting_link ? (
                  <a
                    href={request.meeting_link}
                    target='_blank'
                    rel='noreferrer'
                    className='primary-btn patient-appointment-step__join-btn'
                  >
                    Join meeting
                  </a>
                ) : null}
              </div>
            ) : (
              <>
                <p className='muted patient-appointment-step__intro'>
                  Our PSE team will share your appointment link shortly. Please wait while we connect you
                  with the doctor.
                </p>
                {request.scheduled_at ? (
                  <div className='patient-appointment-detail-card'>
                    <div className='patient-appointment-detail-card__row'>
                      <span className='patient-appointment-detail-card__icon' aria-hidden>
                        <Calendar size={18} />
                      </span>
                      <div className='patient-appointment-detail-card__content'>
                        <span className='patient-appointment-detail-card__label'>Appointment date</span>
                        <p className='patient-appointment-detail-card__value'>
                          {formatAppointmentDisplay(request.scheduled_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {request.meeting_link?.trim() && !hasConsultationSummary(summary) ? (
              <p className='muted patient-appointment-step__footer'>
                After your consultation, your doctor&apos;s notes will appear under Consultation notes as
                a PDF.
              </p>
            ) : null}
          </div>
        );
      case 5:
        return (
          <div className='doctor-response-block patient-view'>
            {hasConsultationSummary(summary) && summary ? (
              <ConsultationSummaryPdfView summary={summary} request={request} />
            ) : (
              <p className='muted'>Your doctor&apos;s consultation summary will appear here as a PDF after your visit.</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className='patient-consultation-wizard patient-consultation-wizard--accordion patient-consultation-wizard--modern'>
      <header className='patient-consultation-wizard__hero'>
        <div className='patient-consultation-wizard__hero-text'>
          <h4 className='patient-consultation-wizard__heading'>Your consultation progress</h4>
          <p className='patient-consultation-wizard__subheading'>Track your request in real-time.</p>
        </div>
        <div className='patient-consultation-wizard__hero-art' aria-hidden>
          <span className='patient-consultation-wizard__hero-clipboard'>
            <ClipboardList size={34} strokeWidth={1.5} />
          </span>
          <span className='patient-consultation-wizard__hero-shield'>
            <ShieldCheck size={18} strokeWidth={2} />
          </span>
        </div>
      </header>

      <nav className='patient-wizard-timeline' aria-label='Consultation progress'>
        <ol className='patient-wizard-timeline__track'>
          {PATIENT_WIZARD_STEPS.map((stepDef, index) => {
            const step = wizardSteps[index];
            const isLast = index === PATIENT_WIZARD_STEPS.length - 1;
            const isAccessible = canPatientNavigateToStep(index, progressCtx);
            const isExpanded = expandedStep === index;
            const isCurrent = index === suggestedStep;
            const isComplete = step.state === 'complete';
            const StepIcon = PATIENT_STEP_ICONS[index] ?? FileText;
            const stateClass = isComplete
              ? 'patient-wizard-timeline__step--complete'
              : isCurrent
                ? 'patient-wizard-timeline__step--current'
                : 'patient-wizard-timeline__step--upcoming';

            return (
              <li
                key={stepDef.id}
                className={`patient-wizard-timeline__step ${stateClass} ${
                  isExpanded ? 'patient-wizard-timeline__step--expanded' : ''
                } ${!isAccessible ? 'patient-wizard-timeline__step--locked' : ''}`}
              >
                <div className='patient-wizard-timeline__rail' aria-hidden>
                  <span className='patient-wizard-timeline__marker'>{stepDef.id}</span>
                  {!isLast ? <span className='patient-wizard-timeline__line' /> : null}
                </div>

                <article className='patient-wizard-card'>
                  {isAccessible ? (
                    <button
                      type='button'
                      className='patient-wizard-card__header'
                      onClick={() => toggleStep(index)}
                      aria-expanded={isExpanded}
                      aria-controls={`consultation-step-panel-${index}`}
                      id={`consultation-step-header-${index}`}
                    >
                      <span className='patient-wizard-card__icon' aria-hidden>
                        {isComplete && index === 0 ? (
                          <Check size={20} strokeWidth={2.5} />
                        ) : (
                          <StepIcon size={20} strokeWidth={2} />
                        )}
                      </span>
                      <span className='patient-wizard-card__labels'>
                        <span className='patient-wizard-card__title-row'>
                          <span className='patient-wizard-card__title'>{stepDef.title}</span>
                          {isCurrent ? (
                            <span className='patient-wizard-card__badge'>In progress</span>
                          ) : null}
                        </span>
                        <span className='patient-wizard-card__subtitle'>{stepDef.subtitle}</span>
                      </span>
                      <ChevronDown size={18} className='patient-wizard-card__chevron' aria-hidden />
                    </button>
                  ) : (
                    <div
                      className='patient-wizard-card__header patient-wizard-card__header--locked'
                      aria-disabled='true'
                    >
                      <span className='patient-wizard-card__icon' aria-hidden>
                        <StepIcon size={20} strokeWidth={2} />
                      </span>
                      <span className='patient-wizard-card__labels'>
                        <span className='patient-wizard-card__title'>{stepDef.title}</span>
                        <span className='patient-wizard-card__subtitle'>{stepDef.subtitle}</span>
                      </span>
                      <Lock size={16} className='patient-wizard-card__lock' aria-hidden />
                    </div>
                  )}

                  {isAccessible && isExpanded ? (
                    <div
                      id={`consultation-step-panel-${index}`}
                      role='region'
                      aria-labelledby={`consultation-step-header-${index}`}
                      className='patient-wizard-card__panel'
                    >
                      <div className='patient-wizard-card__panel-inner'>{renderStepContent(index)}</div>
                    </div>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      </nav>

      <PatientRequestRecordsModal
        open={documentsModalOpen}
        records={request.records}
        onClose={() => setDocumentsModalOpen(false)}
        onOpenRecord={onOpenRecord}
      />
    </div>
  );
}
