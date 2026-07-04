import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Anchor, Button, Stack, Text, TextInput } from '@mantine/core';
import ConsultationSummaryPdfView from '../../../components/ConsultationWorkflow/ConsultationSummaryPdfView';
import ConsultationWizardAccordion from '../../../components/ConsultationWorkflow/ConsultationWizardAccordion';
import {
  canPseNavigateToStep,
  getInitialPseWizardStep,
  getMaxCompletedStepIndex,
  getSuggestedActiveStep,
  getWizardSteps,
  canPseSendPaymentLink,
  hasConsultationSummary,
  isConsultationNotesComplete,
  readPseWizardStoredStep,
  resolvePsePaymentQuote,
  resolveWizardStepOnUpdate,
  writePseWizardStoredStep,
  type WizardProgressContext
} from '../../../lib/consultationWizard';
import {
  fetchConsultationSummary,
  fetchOpinionRequestRecommendations,
  fetchStaffOpinionRequestById,
  pseConfirmPayment,
  pseMarkCaseDetailsReviewed,
  pseMarkRecordsVerified,
  pseProceedWithoutRecords,
  pseRejectRecords,
  pseReleaseToDoctor,
  pseScheduleAppointment,
  pseSendInvoiceAndPaymentLink,
  pseMarkPaymentPendingNoLink,
  subscribeOpinionRequestLiveUpdates
} from '../../../lib/opinionRequests';
import {
  formatConsultationFee,
  normalizeConsultationCurrency
} from '../../../lib/consultationCurrency';
import { formatDurationMinutesLabel } from '../../../lib/consultationTiers';
import AppointmentDateTimePicker from './AppointmentDateTimePicker';
import PsePatientCaseDetailsPanel from './PsePatientCaseDetailsPanel';
import PsePaymentStepPanel from './PsePaymentStepPanel';
import PseRequestRecordsGallery from './PseRequestRecordsGallery';
import RecommendDoctorsSection from './RecommendDoctorsSection';
import type { Doctor } from '../../../types/doctor';
import type { ConsultationSummary, OpinionRequest, OpinionRequestRecommendation } from '../../../types/opinionRequest';
import { formatRequestDate } from './requestsUtils';

const ELIX_EXTERNAL_PAYMENT_BASE_URL = 'https://elixclinix.com/pay.html?amount=';

function buildExternalPaymentLink(amount: number | null) {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return '';
  return `${ELIX_EXTERNAL_PAYMENT_BASE_URL}${encodeURIComponent(amount.toFixed(2))}`;
}

function resolveInvoiceDoctor(request: OpinionRequest, doctors: Doctor[]): Doctor | null {
  const doctorId = request.selected_doctor_id ?? request.doctor_id;
  if (!doctorId) return null;
  return doctors.find((doctor) => doctor.id === doctorId) ?? null;
}

type RequestWorkflowWizardProps = {
  request: OpinionRequest;
  doctors: Doctor[];
  canCoordinate: boolean;
  onOpenRecord: (storagePath: string) => void;
  onUpdated: () => void;
  onRequestPatch?: (patch: Partial<OpinionRequest> & { id: string }) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export default function RequestWorkflowWizard({
  request,
  doctors,
  canCoordinate,
  onOpenRecord,
  onUpdated,
  onRequestPatch,
  onError,
  onSuccess
}: RequestWorkflowWizardProps) {
  const initialProgressCtx: WizardProgressContext = useMemo(
    () => ({
      request,
      recommendationsCount: 0,
      hasSummary: false
    }),
    [request]
  );
  const initialWizardStep = getInitialPseWizardStep(initialProgressCtx);
  const [expandedStep, setExpandedStep] = useState<number | null>(() => {
    const stored = readPseWizardStoredStep(request.id);
    return stored ?? initialWizardStep;
  });
  const stepStateRef = useRef<{ requestId: string | null; step: number | null; lastSuggested: number }>({
    requestId: request.id,
    step: expandedStep ?? initialWizardStep,
    lastSuggested: initialWizardStep
  });
  const [recommendations, setRecommendations] = useState<OpinionRequestRecommendation[]>([]);
  const [summary, setSummary] = useState<ConsultationSummary | null>(null);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const loadMeta = useCallback(async () => {
    const [recRes, summaryRes] = await Promise.all([
      fetchOpinionRequestRecommendations(request.id),
      fetchConsultationSummary(request.id)
    ]);
    if (!recRes.error) {
      const list = recRes.data ?? [];
      setRecommendations(list);
    }
    if (!summaryRes.error) setSummary(summaryRes.data);
  }, [request.id]);

  useEffect(() => {
    if (request.scheduled_at) {
      const parsed = new Date(request.scheduled_at);
      setScheduledAt(Number.isNaN(parsed.getTime()) ? null : parsed);
    } else {
      setScheduledAt(null);
    }
    setMeetingLink(request.meeting_link ?? '');
    setPaymentReference(request.payment_reference ?? '');
    void loadMeta();
  }, [request, loadMeta]);

  const progressCtx: WizardProgressContext = useMemo(
    () => ({
      request,
      recommendationsCount: recommendations.length,
      hasSummary: hasConsultationSummary(summary)
    }),
    [request, recommendations.length, summary]
  );

  const isClosedRequest = request.status === 'closed';
  const isReadOnlyView = !canCoordinate;

  const suggestedStep = useMemo(() => getSuggestedActiveStep(progressCtx, 'pse'), [progressCtx]);
  const maxNavigableStep = useMemo(
    () => getMaxCompletedStepIndex(progressCtx, 'pse') + 1,
    [progressCtx]
  );

  useEffect(() => {
    if (isClosedRequest && !canCoordinate) return;
    const next = resolveWizardStepOnUpdate(request.id, suggestedStep, stepStateRef.current, {
      audience: 'pse',
      maxNavigableStep
    });
    stepStateRef.current = next;
    setExpandedStep(next.step);
  }, [request.id, suggestedStep, maxNavigableStep, isClosedRequest, canCoordinate]);

  useEffect(() => {
    return subscribeOpinionRequestLiveUpdates(request.id, (hint) => {
      if (hint?.type === 'case_details' && onRequestPatch) {
        onRequestPatch({
          id: request.id,
          patient_case_details: hint.patient_case_details ?? null,
          message: hint.message ?? request.message,
          requested_specialty: hint.requested_specialty ?? request.requested_specialty
        });
      }
      void fetchStaffOpinionRequestById(request.id).then((result) => {
        if (result.data) onRequestPatch?.(result.data);
      });
      void loadMeta();
      onUpdated();
    });
  }, [request.id, request.message, request.requested_specialty, loadMeta, onUpdated, onRequestPatch]);

  const wizardSteps = getWizardSteps('pse', progressCtx, expandedStep ?? suggestedStep);
  const paymentQuote = useMemo(
    () => resolvePsePaymentQuote(request, doctors, recommendations),
    [request, doctors, recommendations]
  );
  const payableAmountForLink = useMemo(() => {
    const invoiceTotal = Number(request.invoice_total);
    if (Number.isFinite(invoiceTotal) && invoiceTotal > 0) return invoiceTotal;
    return paymentQuote.amount;
  }, [request.invoice_total, paymentQuote.amount]);
  const autoPaymentLink = useMemo(
    () => buildExternalPaymentLink(payableAmountForLink),
    [payableAmountForLink]
  );

  useEffect(() => {
    if (autoPaymentLink) {
      setPaymentLink(autoPaymentLink);
      return;
    }
    setPaymentLink(request.payment_link ?? '');
  }, [autoPaymentLink, request.payment_link]);

  const canNavigateStep = (index: number) =>
    isClosedRequest || isReadOnlyView
      ? index >= 0 && index < wizardSteps.length
      : canPseNavigateToStep(index, progressCtx);

  const setExpandedStepTracked = (index: number | null) => {
    if (index !== null) {
      writePseWizardStoredStep(request.id, index);
      stepStateRef.current = { ...stepStateRef.current, step: index };
    }
    setExpandedStep(index);
  };

  useEffect(() => {
    if (!isClosedRequest || canCoordinate) return;
    const lastIndex = wizardSteps.length - 1;
    const target = isConsultationNotesComplete(progressCtx)
      ? lastIndex
      : Math.max(getMaxCompletedStepIndex(progressCtx, 'pse'), 0);
    setExpandedStepTracked(target);
  }, [
    isClosedRequest,
    canCoordinate,
    request.id,
    progressCtx.hasSummary,
    progressCtx.recommendationsCount,
    wizardSteps.length
  ]);

  const toggleStep = (index: number) => {
    if (!canNavigateStep(index)) return;
    setExpandedStepTracked(expandedStep === index ? null : index);
  };

  const goToStep = (index: number) => {
    if (!canNavigateStep(index)) return;
    setExpandedStepTracked(index);
  };

  const markRecordsVerified = async () => {
    setBusy(true);
    const { error } = await pseMarkRecordsVerified(request.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Medical records marked as verified. The patient will see this on their dashboard.');
    onUpdated();
    void loadMeta();
    setExpandedStepTracked(3);
  };

  const proceedWithoutRecords = async () => {
    setBusy(true);
    const { error } = await pseProceedWithoutRecords(request.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Marked as proceeding without attached records.');
    onUpdated();
    void loadMeta();
    setExpandedStepTracked(3);
  };

  const markCaseDetailsReviewed = async () => {
    setBusy(true);
    const { error } = await pseMarkCaseDetailsReviewed(request.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Patient case details marked as reviewed.');
    onUpdated();
    void loadMeta();
    setExpandedStepTracked(2);
  };

  const submitRecordRejection = async () => {
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      onError('Please provide a reason for rejecting the records before sending.');
      return;
    }
    setBusy(true);
    const { error } = await pseRejectRecords(request.id, trimmed);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Rejection sent to patient. They will see the reason on their dashboard.');
    setRejectReason('');
    setShowRejectForm(false);
    onUpdated();
    void loadMeta();
  };

  const handleSchedule = async () => {
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      onError('Select a date and time for the appointment.');
      return;
    }
    setBusy(true);
    const { error } = await pseScheduleAppointment(request.id, {
      scheduledAt: scheduledAt.toISOString(),
      meetingLink
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Appointment scheduled. The patient will see the meeting link after payment is confirmed.');
    onUpdated();
  };

  const handleSendInvoiceAndPaymentLink = async () => {
    if (!canPseSendPaymentLink(request)) {
      onError('Wait for the patient to confirm the schedule before sending a payment link.');
      return;
    }
    if (!paymentLink.trim()) {
      onError('Enter a payment link for the patient.');
      return;
    }
    const { amount, currency } = paymentQuote;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      onError('Consultation fee is missing. Confirm the patient selected a doctor and session length.');
      return;
    }

    setBusy(true);
    const doctor = resolveInvoiceDoctor(request, doctors);
    if (!doctor) {
      setBusy(false);
      onError('Could not load the selected doctor profile. Refresh and try again.');
      return;
    }

    const { error } = await pseSendInvoiceAndPaymentLink(request, {
      paymentLink,
      amount,
      currency,
      doctor
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess(
      request.payment_link?.trim()
        ? 'Invoice regenerated and payment link updated for the patient.'
        : 'Invoice generated and payment link sent to the patient.'
    );
    onUpdated();
  };

  const handlePaymentPending = async () => {
    if (!canPseSendPaymentLink(request)) {
      onError('Wait for the patient to confirm the schedule before marking payment pending.');
      return;
    }
    const { amount, currency } = paymentQuote;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      onError('Consultation fee is missing. Confirm the patient selected a doctor and session length.');
      return;
    }
    const doctor = resolveInvoiceDoctor(request, doctors);
    if (!doctor) {
      onError('Could not load the selected doctor profile. Refresh and try again.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await pseMarkPaymentPendingNoLink(request, { amount, currency, doctor });
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        onRequestPatch?.(data as Partial<OpinionRequest> & { id: string });
      }
      onSuccess('Marked as payment pending — patient will see payment required.');
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not mark payment as pending.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPayment = async () => {
    setBusy(true);
    const { amount, currency } = paymentQuote;
    const chargeAmount = request.invoice_total ?? amount;
    const { error } = await pseConfirmPayment(request.id, {
      amount: chargeAmount,
      currency,
      reference: paymentReference
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Payment confirmed.');
    onUpdated();
    setExpandedStepTracked(5);
  };

  const handleReleaseToDoctor = async () => {
    if (request.payment_status !== 'paid') {
      onError('Confirm payment before releasing to the doctor.');
      return;
    }
    setBusy(true);
    const { error } = await pseReleaseToDoctor(request.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Released to doctor for consultation.');
    onUpdated();
  };

  const renderStepContent = (index: number) => {
    switch (index) {
      case 0:
        return (
          <Stack gap='sm' className='request-workflow-step'>
            <Text fw={600} size='sm'>
              Step 1 — Request from patient
            </Text>
            <Text size='sm'>
              <Text span fw={600}>
                {request.doctor_name ? 'Doctor requested: ' : 'Specialty requested: '}
              </Text>
              {request.doctor_name ?? request.requested_specialty ?? '—'}
              {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
            </Text>
            {request.consultation_duration_minutes && request.consultation_fee_usd != null ? (
              <Text size='sm'>
                <Text span fw={600}>
                  Consultation quote:{' '}
                </Text>
                {formatDurationMinutesLabel(request.consultation_duration_minutes)} ·{' '}
                {formatConsultationFee(
                  request.consultation_fee_usd,
                  normalizeConsultationCurrency(request.consultation_currency)
                )}
              </Text>
            ) : null}
            <Text size='sm' c='dimmed'>
              Submitted {formatRequestDate(request.created_at)}
            </Text>
            <Text size='sm' fw={600} mt='xs'>
              Patient message
            </Text>
            <Text size='sm'>{request.message}</Text>
            {request.assigned_to_name ? (
              <Text size='sm'>
                <Text span fw={600}>
                  Assigned to:{' '}
                </Text>
                {request.assigned_to_name}
              </Text>
            ) : null}
            {canCoordinate ? (
              <Button variant='light' color='cyan' radius='md' onClick={() => goToStep(1)}>
                Continue to case details →
              </Button>
            ) : null}
          </Stack>
        );
      case 1:
        return (
          <PsePatientCaseDetailsPanel
            request={request}
            busy={busy}
            canCoordinate={canCoordinate}
            onMarkReviewed={() => void markCaseDetailsReviewed()}
            onUpdated={onUpdated}
            onError={onError}
            onSuccess={onSuccess}
          />
        );
      case 2: {
        const hasRecords = request.records.length > 0;
        return (
          <Stack gap='sm' className='request-workflow-step'>
            <Text size='xs' c='dimmed'>
              Open each file and confirm it matches the patient&apos;s case before recommending
              doctors.
            </Text>
            {request.patient_proceeded_without_records_at && !hasRecords ? (
              <Text size='sm' c='blue'>
                Patient chose to proceed without documents on{' '}
                {new Date(request.patient_proceeded_without_records_at).toLocaleString()}.
              </Text>
            ) : null}
            <PseRequestRecordsGallery
              records={request.records}
              requestId={request.id}
              onOpenRecord={onOpenRecord}
            />
            {request.records_verified_at ? (
              <Text size='sm' c='green'>
                Verified {new Date(request.records_verified_at).toLocaleString()}
              </Text>
            ) : request.pse_proceeded_without_records_at ? (
              <Text size='sm' c='green'>
                Proceeded without records{' '}
                {new Date(request.pse_proceeded_without_records_at).toLocaleString()}
              </Text>
            ) : request.records_rejected_at ? (
              <Stack gap='xs'>
                <Text size='sm' c='red'>
                  Rejected {new Date(request.records_rejected_at).toLocaleString()}
                </Text>
                {request.records_rejection_reason ? (
                  <Text size='sm' c='dimmed'>
                    Reason: {request.records_rejection_reason}
                  </Text>
                ) : null}
              </Stack>
            ) : canCoordinate ? (
              <Stack gap='sm'>
                {hasRecords ? (
                  <Button
                    className='doctors-mgmt-header__primary'
                    radius='md'
                    loading={busy}
                    onClick={() => void markRecordsVerified()}
                  >
                    Approve
                  </Button>
                ) : (
                  <Button
                    className='doctors-mgmt-header__primary'
                    radius='md'
                    loading={busy}
                    onClick={() => void proceedWithoutRecords()}
                  >
                    Proceed
                  </Button>
                )}
                {hasRecords ? (
                  !showRejectForm ? (
                    <Button
                      variant='outline'
                      color='red'
                      radius='md'
                      onClick={() => setShowRejectForm(true)}
                    >
                      Reject
                    </Button>
                  ) : (
                    <Stack gap='xs' className='pse-records-reject-form'>
                      <Text size='sm' fw={600}>
                        Rejection reason
                      </Text>
                      <Text size='xs' c='dimmed'>
                        Describe why the records cannot be accepted. The patient will see this on their
                        dashboard.
                      </Text>
                      <textarea
                        className='pse-reject-textarea'
                        rows={4}
                        placeholder='e.g. The uploaded files are unreadable. Please re-upload clear scans of your reports.'
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <Stack gap='xs'>
                        <Button
                          color='red'
                          radius='md'
                          loading={busy}
                          disabled={!rejectReason.trim()}
                          onClick={() => void submitRecordRejection()}
                        >
                          Send Rejection to Patient
                        </Button>
                        <Button
                          variant='subtle'
                          radius='md'
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectReason('');
                          }}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    </Stack>
                  )
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        );
      }
      case 3:
        return (
          <Stack gap='sm' className='request-workflow-step'>
            <RecommendDoctorsSection
              request={request}
              doctors={doctors}
              canCoordinate={canCoordinate}
              onUpdated={() => {
                onUpdated();
                void loadMeta();
              }}
              onError={onError}
              onSuccess={onSuccess}
              onPatientSelectionApproved={() => setExpandedStepTracked(4)}
            />
            {canCoordinate && canPseSendPaymentLink(request) ? (
              <Button variant='light' color='cyan' radius='md' onClick={() => goToStep(4)}>
                Continue to send payment link →
              </Button>
            ) : null}
          </Stack>
        );
      case 4:
        return (
          <PsePaymentStepPanel
            request={request}
            paymentLink={paymentLink}
            paymentAmount={paymentQuote.amount}
            paymentCurrency={paymentQuote.currency}
            paymentReference={paymentReference}
            paymentLinkPlaceholder={autoPaymentLink || ELIX_EXTERNAL_PAYMENT_BASE_URL}
            busy={busy}
            readOnly={!canCoordinate}
            onPaymentReferenceChange={setPaymentReference}
            onSendInvoiceAndPaymentLink={() => void handleSendInvoiceAndPaymentLink()}
            onMarkPending={() => void handlePaymentPending()}
            onConfirmPayment={() => void handleConfirmPayment()}
            onReleaseToDoctor={() => void handleReleaseToDoctor()}
          />
        );
      case 5:
        return canCoordinate ? (
          <Stack gap='md' className='request-workflow-step'>
            <AppointmentDateTimePicker value={scheduledAt} onChange={setScheduledAt} />
            <TextInput
              label='Meeting link'
              placeholder='https://meet.google.com/...'
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.currentTarget.value)}
            />
            <Button
              className='doctors-mgmt-header__primary'
              radius='md'
              loading={busy}
              onClick={() => void handleSchedule()}
            >
              Save schedule & meeting link
            </Button>
            {request.scheduled_at ? (
              <Text size='sm' c='dimmed'>
                Current: {new Date(request.scheduled_at).toLocaleString()}
                {request.meeting_link ? ` · ${request.meeting_link}` : ''}
              </Text>
            ) : null}
          </Stack>
        ) : (
          <Stack gap='sm' className='request-workflow-step'>
            <Text fw={600} size='sm'>
              Appointment schedule
            </Text>
            {request.scheduled_at ? (
              <Text size='sm'>
                {new Date(request.scheduled_at).toLocaleString()}
                {request.meeting_link ? (
                  <>
                    {' '}
                    ·{' '}
                    <Anchor href={request.meeting_link} target='_blank' rel='noreferrer' size='sm'>
                      {request.meeting_link}
                    </Anchor>
                  </>
                ) : null}
              </Text>
            ) : (
              <Text size='sm' c='dimmed'>
                No appointment was scheduled.
              </Text>
            )}
          </Stack>
        );
      case 6:
        return (
          <Stack gap='sm' className='request-workflow-step'>
            {hasConsultationSummary(summary) && summary ? (
              <ConsultationSummaryPdfView summary={summary} request={request} />
            ) : request.doctor_response?.trim() ? (
              <>
                <Text fw={600} size='sm'>
                  Doctor response
                </Text>
                <Text size='sm'>{request.doctor_response}</Text>
                {request.responded_at ? (
                  <Text size='xs' c='dimmed'>
                    Submitted {new Date(request.responded_at).toLocaleString()}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text size='sm' c='dimmed'>
                No consultation summary yet. The doctor submits notes after the appointment is
                completed.
              </Text>
            )}
            {canCoordinate ? (
              <Button variant='subtle' size='xs' onClick={() => void loadMeta()}>
                Refresh
              </Button>
            ) : null}
          </Stack>
        );
      default:
        return null;
    }
  };

  return (
    <ConsultationWizardAccordion
      className='request-workflow-wizard patient-consultation-wizard--accordion'
      heading='Coordination workflow'
      subheading='Manage each step of this patient request.'
      steps={wizardSteps}
      expandedIndex={expandedStep}
      suggestedIndex={suggestedStep}
      canNavigate={canNavigateStep}
      onToggle={toggleStep}
      renderPanel={renderStepContent}
    />
  );
}
