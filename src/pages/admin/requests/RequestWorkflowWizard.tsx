import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Stack, Text, TextInput } from '@mantine/core';
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
  readPseWizardStoredStep,
  resolvePsePaymentQuote,
  resolveWizardStepOnUpdate,
  writePseWizardStoredStep,
  type WizardProgressContext
} from '../../../lib/consultationWizard';
import {
  fetchConsultationSummary,
  fetchOpinionRequestRecommendations,
  pseConfirmPayment,
  pseGenerateConsultationInvoice,
  pseMarkRecordsVerified,
  pseReleaseToDoctor,
  pseScheduleAppointment,
  pseSendInvoiceAndPaymentLink,
  pseSetPaymentPending,
  subscribeOpinionRequestLiveUpdates
} from '../../../lib/opinionRequests';
import {
  formatConsultationFee,
  normalizeConsultationCurrency
} from '../../../lib/consultationCurrency';
import { formatDurationMinutesLabel } from '../../../lib/consultationTiers';
import AppointmentDateTimePicker from './AppointmentDateTimePicker';
import PsePaymentStepPanel from './PsePaymentStepPanel';
import PseRequestRecordsGallery from './PseRequestRecordsGallery';
import RecommendDoctorsSection from './RecommendDoctorsSection';
import type { Doctor } from '../../../types/doctor';
import type { ConsultationSummary, OpinionRequest, OpinionRequestRecommendation } from '../../../types/opinionRequest';
import { formatRequestDate } from './requestsUtils';

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
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

export default function RequestWorkflowWizard({
  request,
  doctors,
  canCoordinate,
  onOpenRecord,
  onUpdated,
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
    setPaymentLink(request.payment_link ?? '');
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

  const suggestedStep = useMemo(() => getSuggestedActiveStep(progressCtx, 'pse'), [progressCtx]);
  const maxNavigableStep = useMemo(
    () => getMaxCompletedStepIndex(progressCtx, 'pse') + 1,
    [progressCtx]
  );

  useEffect(() => {
    const next = resolveWizardStepOnUpdate(request.id, suggestedStep, stepStateRef.current, {
      audience: 'pse',
      maxNavigableStep
    });
    stepStateRef.current = next;
    setExpandedStep(next.step);
  }, [request.id, suggestedStep, maxNavigableStep]);

  useEffect(() => {
    return subscribeOpinionRequestLiveUpdates(request.id, () => {
      void loadMeta();
      onUpdated();
    });
  }, [request.id, loadMeta, onUpdated]);

  const wizardSteps = getWizardSteps('pse', progressCtx, expandedStep ?? suggestedStep);
  const paymentQuote = useMemo(
    () => resolvePsePaymentQuote(request, doctors, recommendations),
    [request, doctors, recommendations]
  );

  const setExpandedStepTracked = (index: number | null) => {
    if (index !== null) {
      writePseWizardStoredStep(request.id, index);
      stepStateRef.current = { ...stepStateRef.current, step: index };
    }
    setExpandedStep(index);
  };

  const toggleStep = (index: number) => {
    if (!canPseNavigateToStep(index, progressCtx)) return;
    setExpandedStepTracked(expandedStep === index ? null : index);
  };

  const goToStep = (index: number) => {
    if (!canPseNavigateToStep(index, progressCtx)) return;
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
    setExpandedStepTracked(2);
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

  const generateInvoiceForRequest = async () => {
    const { amount, currency } = paymentQuote;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      return {
        data: null,
        error: { message: 'Consultation fee is missing. Confirm the patient selected a doctor and session length.' }
      };
    }
    const doctor = resolveInvoiceDoctor(request, doctors);
    if (!doctor) {
      return {
        data: null,
        error: { message: 'Could not load the selected doctor profile. Refresh and try again.' }
      };
    }
    return pseGenerateConsultationInvoice(request, { amount, currency, doctor });
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
    setBusy(true);
    if (!request.invoice_pdf_storage_path?.trim()) {
      const invoiceRes = await generateInvoiceForRequest();
      if (invoiceRes.error) {
        setBusy(false);
        onError(invoiceRes.error.message);
        return;
      }
    }
    const { error } = await pseSetPaymentPending(request.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess('Marked as payment pending — patient will see payment required.');
    onUpdated();
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
    setExpandedStepTracked(4);
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
            <Button variant='light' color='cyan' radius='md' onClick={() => goToStep(1)}>
              Continue to verify records →
            </Button>
          </Stack>
        );
      case 1:
        return (
          <Stack gap='sm' className='request-workflow-step'>
            <Text size='xs' c='dimmed'>
              Open each file and confirm it matches the patient&apos;s case before recommending doctors.
            </Text>
            <PseRequestRecordsGallery
              records={request.records}
              requestId={request.id}
              onOpenRecord={onOpenRecord}
            />
            {request.records_verified_at ? (
              <Text size='sm' c='green'>
                Verified {new Date(request.records_verified_at).toLocaleString()}
              </Text>
            ) : canCoordinate ? (
              <Button
                className='doctors-mgmt-header__primary'
                radius='md'
                loading={busy}
                onClick={() => void markRecordsVerified()}
              >
                Mark records as verified
              </Button>
            ) : null}
          </Stack>
        );
      case 2:
        if (!canCoordinate) return null;
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
              onPatientSelectionApproved={() => setExpandedStepTracked(3)}
            />
            {canPseSendPaymentLink(request) ? (
              <Button variant='light' color='cyan' radius='md' onClick={() => goToStep(3)}>
                Continue to send payment link →
              </Button>
            ) : null}
          </Stack>
        );
      case 3:
        if (!canCoordinate) return null;
        return (
          <PsePaymentStepPanel
            request={request}
            paymentLink={paymentLink}
            paymentAmount={paymentQuote.amount}
            paymentCurrency={paymentQuote.currency}
            paymentReference={paymentReference}
            busy={busy}
            onPaymentLinkChange={setPaymentLink}
            onPaymentReferenceChange={setPaymentReference}
            onSendInvoiceAndPaymentLink={() => void handleSendInvoiceAndPaymentLink()}
            onMarkPending={() => void handlePaymentPending()}
            onConfirmPayment={() => void handleConfirmPayment()}
            onReleaseToDoctor={() => void handleReleaseToDoctor()}
          />
        );
      case 4:
        if (!canCoordinate) return null;
        return (
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
        );
      case 5:
        return (
          <Stack gap='sm' className='request-workflow-step'>
            {hasConsultationSummary(summary) && summary ? (
              <ConsultationSummaryPdfView summary={summary} request={request} />
            ) : (
              <Text size='sm' c='dimmed'>
                No consultation summary yet. The doctor submits notes after the appointment is completed.
              </Text>
            )}
            <Button variant='subtle' size='xs' onClick={() => void loadMeta()}>
              Refresh
            </Button>
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
      canNavigate={(index) => canCoordinate && canPseNavigateToStep(index, progressCtx)}
      onToggle={toggleStep}
      renderPanel={renderStepContent}
    />
  );
}
