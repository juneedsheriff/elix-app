import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Anchor, Button, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import dayjs from 'dayjs';
import { IconCalendar } from '@tabler/icons-react';
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
  isPseHomeCareWizard,
  resolvePsePaymentQuote,
  resolveWizardStepOnUpdate,
  writePseWizardStoredStep,
  type WizardProgressContext
} from '../../../lib/consultationWizard';
import { homeCareServicesFromRequest } from '../../../lib/homeCareServices';
import {
  fetchConsultationSummary,
  consultationSummaryFromDoctorResponse,
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
  pseSendHomeCarePaymentLink,
  pseConfirmHomeCarePayment,
  pseCompleteHomeCareRequest,
  pseMarkPaymentPendingNoLink,
  canPseManageRequestRecords,
  pseDeleteRequestRecord,
  subscribeOpinionRequestLiveUpdates
} from '../../../lib/opinionRequests';
import {
  formatConsultationFee,
  normalizeConsultationCurrency,
  type ConsultationCurrency
} from '../../../lib/consultationCurrency';
import AppointmentDateTimePicker from './AppointmentDateTimePicker';
import PsePatientCaseDetailsPanel from './PsePatientCaseDetailsPanel';
import PsePaymentStepPanel from './PsePaymentStepPanel';
import PseRequestRecordsGallery from './PseRequestRecordsGallery';
import PseUploadRecordsModal from './PseUploadRecordsModal';
import RecommendDoctorsSection from './RecommendDoctorsSection';
import type { Doctor } from '../../../types/doctor';
import type {
  ConsultationSummary,
  OpinionRequest,
  OpinionRequestFile,
  OpinionRequestRecommendation
} from '../../../types/opinionRequest';
import { formatRequestDate } from './requestsUtils';

const ELIX_EXTERNAL_PAYMENT_BASE_URL = 'https://elixclinix.com/pay.html?amount=';

function buildExternalPaymentLink(amount: number | null) {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return '';
  return `${ELIX_EXTERNAL_PAYMENT_BASE_URL}${encodeURIComponent(amount.toFixed(2))}`;
}

function buildHomeCarePaymentLinkFromAmountInput(input: string): string {
  const trimmed = input.trim();
  const amountToken = trimmed === '' || !Number.isFinite(Number(trimmed)) ? '0' : trimmed;
  return `${ELIX_EXTERNAL_PAYMENT_BASE_URL}${encodeURIComponent(amountToken)}`;
}

function isElixPayHtmlLink(link: string): boolean {
  const trimmed = link.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed);
    return url.origin === 'https://elixclinix.com' && url.pathname.endsWith('/pay.html');
  } catch {
    return (
      trimmed.startsWith(ELIX_EXTERNAL_PAYMENT_BASE_URL) || /elixclinix\.com\/pay\.html/i.test(trimmed)
    );
  }
}

/** Read `amount` from a payment URL (query or trailing `amount=`). */
function parseAmountFromPaymentLink(link: string, options?: { allowZero?: boolean }): number | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  const minExclusive = options?.allowZero ? -1 : 0;
  try {
    const url = new URL(trimmed);
    const raw = url.searchParams.get('amount');
    if (raw != null && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > minExclusive) return parsed;
    }
  } catch {
    // fall through to regex for non-absolute / partial URLs
  }
  const match = trimmed.match(/[?&]amount=([^&]+)/i) ?? trimmed.match(/amount=([^&\s]+)/i);
  if (!match?.[1]) return null;
  const parsed = Number(decodeURIComponent(match[1]));
  if (!Number.isFinite(parsed) || parsed <= minExclusive) return null;
  return parsed;
}

/** Keep custom URLs; for Elix pay links, rewrite the amount query to `amount`. */
function withPaymentLinkAmount(link: string, amount: number): string {
  const trimmed = link.trim();
  if (!trimmed || !Number.isFinite(amount) || amount <= 0) return trimmed;
  const amountText = amount.toFixed(2);
  try {
    const url = new URL(trimmed);
    if (url.origin === 'https://elixclinix.com' && url.pathname.endsWith('/pay.html')) {
      url.searchParams.set('amount', amountText);
      return url.toString();
    }
  } catch {
    // ignore
  }
  if (trimmed.startsWith(ELIX_EXTERNAL_PAYMENT_BASE_URL) || /pay\.html\?amount=/i.test(trimmed)) {
    return buildExternalPaymentLink(amount);
  }
  return trimmed;
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
  onOpenRecord: (storagePath: string, requestId?: string) => void;
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
  const isHomeCare = isPseHomeCareWizard(request);
  const isCompactViewport = useMediaQuery('(max-width: 1024px)');
  const initialProgressCtx: WizardProgressContext = useMemo(
    () => ({
      request,
      recommendationsCount: 0,
      hasSummary: false
    }),
    [request]
  );
  const initialWizardStep = getInitialPseWizardStep(initialProgressCtx);
  const [expandedStep, setExpandedStep] = useState<number | null>(() => initialWizardStep);
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
  const [paymentLink, setPaymentLink] = useState(() => {
    const stored = request.payment_link?.trim() ?? '';
    if (stored) return stored;
    if (isPseHomeCareWizard(request)) {
      const amount =
        request.payment_amount != null && Number.isFinite(Number(request.payment_amount))
          ? String(request.payment_amount)
          : '0';
      return buildHomeCarePaymentLinkFromAmountInput(amount);
    }
    return '';
  });
  const [paymentCurrency, setPaymentCurrency] = useState<ConsultationCurrency>(() =>
    normalizeConsultationCurrency(
      request.payment_currency ??
        request.consultation_currency ??
        (isPseHomeCareWizard(request) ? 'INR' : 'USD')
    )
  );
  const paymentCurrencyTouchedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showUploadRecords, setShowUploadRecords] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [homeCareRemarks, setHomeCareRemarks] = useState(request.home_care_remarks ?? '');
  const [homeCareFollowupDate, setHomeCareFollowupDate] = useState(
    request.home_care_followup_date?.slice(0, 10) ?? ''
  );
  const [homeCareCashAmount, setHomeCareCashAmount] = useState(() => {
    if (request.payment_amount != null && Number.isFinite(Number(request.payment_amount))) {
      return String(request.payment_amount);
    }
    const fromLink = parseAmountFromPaymentLink(request.payment_link ?? '', { allowZero: true });
    if (fromLink != null) return String(fromLink);
    return '0';
  });

  useEffect(() => {
    setHomeCareRemarks(request.home_care_remarks ?? '');
    setHomeCareFollowupDate(request.home_care_followup_date?.slice(0, 10) ?? '');
  }, [request.id, request.home_care_remarks, request.home_care_followup_date]);

  useEffect(() => {
    if (request.payment_amount != null && Number.isFinite(Number(request.payment_amount))) {
      setHomeCareCashAmount(String(request.payment_amount));
      return;
    }
    if (isHomeCare) {
      setHomeCareCashAmount((prev) => (prev.trim() === '' ? '0' : prev));
    }
  }, [request.id, request.payment_amount, isHomeCare]);

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
  const lastStepIndex = Math.max(0, getWizardSteps('pse', progressCtx, 0).length - 1);
  const maxNavigableStep = useMemo(() => {
    const next = getMaxCompletedStepIndex(progressCtx, 'pse') + 1;
    return Math.min(next, lastStepIndex);
  }, [progressCtx, lastStepIndex]);

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
    const storedLink = request.payment_link?.trim() ?? '';
    if (storedLink) {
      setPaymentLink(storedLink);
      return;
    }
    if (isHomeCare) {
      setPaymentLink(buildHomeCarePaymentLinkFromAmountInput(homeCareCashAmount || '0'));
      return;
    }
    if (autoPaymentLink) {
      setPaymentLink(autoPaymentLink);
      return;
    }
    setPaymentLink('');
  }, [request.id, request.payment_link, autoPaymentLink, isHomeCare]);

  useEffect(() => {
    paymentCurrencyTouchedRef.current = false;
    setPaymentCurrency(
      normalizeConsultationCurrency(
        request.payment_currency ??
          paymentQuote.currency ??
          request.consultation_currency ??
          (isHomeCare ? 'INR' : 'USD')
      )
    );
  }, [request.id, isHomeCare]);

  useEffect(() => {
    if (request.payment_currency) {
      paymentCurrencyTouchedRef.current = false;
      setPaymentCurrency(normalizeConsultationCurrency(request.payment_currency));
    }
  }, [request.payment_currency]);

  useEffect(() => {
    if (request.payment_currency || paymentCurrencyTouchedRef.current) return;
    setPaymentCurrency(
      normalizeConsultationCurrency(paymentQuote.currency ?? (isHomeCare ? 'INR' : 'USD'))
    );
  }, [paymentQuote.currency, request.payment_currency, isHomeCare]);

  const handlePaymentLinkChange = (value: string) => {
    setPaymentLink(value);
    if (!isHomeCare) return;
    const parsed = parseAmountFromPaymentLink(value, { allowZero: true });
    if (parsed != null) setHomeCareCashAmount(String(parsed));
  };

  const handleHomeCareAmountChange = (value: string) => {
    setHomeCareCashAmount(value);
    if (isElixPayHtmlLink(paymentLink)) {
      setPaymentLink(buildHomeCarePaymentLinkFromAmountInput(value));
    }
  };

  const handlePaymentCurrencyChange = (value: ConsultationCurrency) => {
    paymentCurrencyTouchedRef.current = true;
    setPaymentCurrency(value);
  };

  const canNavigateStep = (index: number) =>
    isClosedRequest || isReadOnlyView
      ? index >= 0 && index < wizardSteps.length
      : canPseNavigateToStep(index, progressCtx);

  const setExpandedStepTracked = (index: number | null) => {
    const clamped =
      index == null ? null : Math.min(Math.max(0, index), lastStepIndex);
    if (clamped !== null) {
      writePseWizardStoredStep(request.id, clamped);
      stepStateRef.current = { ...stepStateRef.current, step: clamped };
    }
    setExpandedStep(clamped);
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

  const deleteRequestRecord = async (record: OpinionRequestFile) => {
    const confirmed = window.confirm(
      `Delete "${record.file_name}" from this request? The file will be removed from the patient's vault for this request.`
    );
    if (!confirmed) return;

    setDeletingRecordId(record.id);
    const { error } = await pseDeleteRequestRecord(request.id, record.id);
    setDeletingRecordId(null);

    if (error) {
      onError(error.message);
      return;
    }

    onSuccess(`"${record.file_name}" deleted.`);
    onUpdated();
    void loadMeta();
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
      meetingLink: meetingLink.trim() || null
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess(
      meetingLink.trim()
        ? 'Appointment scheduled. The patient will see the meeting link after payment is confirmed.'
        : 'Appointment scheduled.'
    );
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
    const { amount: quoteAmount } = paymentQuote;
    const linkAmount = parseAmountFromPaymentLink(paymentLink);
    const manualAmount = (() => {
      const parsed = Number(homeCareCashAmount);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })();
    const amount = linkAmount ?? (isHomeCare ? manualAmount : null) ?? quoteAmount;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      onError(
        isHomeCare
          ? 'Enter an amount (Amount field or …/pay.html?amount=500 in the link) before generating the invoice.'
          : 'Consultation fee is missing. Confirm a doctor is assigned and has a consultation charge on their profile.'
      );
      return;
    }

    const linkToStore = withPaymentLinkAmount(paymentLink, amount);
    const currency = normalizeConsultationCurrency(
      paymentCurrency ?? (isHomeCare ? 'INR' : undefined)
    );

    if (isHomeCare) {
      setBusy(true);
      const { data, error } = await pseSendHomeCarePaymentLink(request, {
        paymentLink: linkToStore,
        amount,
        currency
      });
      setBusy(false);
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        onRequestPatch?.(data as Partial<OpinionRequest> & { id: string });
        setPaymentLink(data.payment_link?.trim() || linkToStore);
        if (data.payment_amount != null) {
          setHomeCareCashAmount(String(data.payment_amount));
        }
      }
      onSuccess(
        request.invoice_pdf_storage_path?.trim()
          ? 'Invoice regenerated and payment link sent to the patient.'
          : 'Invoice generated and payment link sent to the patient.'
      );
      onUpdated();
      return;
    }

    setBusy(true);
    const doctor = resolveInvoiceDoctor(request, doctors);
    if (!doctor) {
      setBusy(false);
      onError('Could not load the selected doctor profile. Refresh and try again.');
      return;
    }

    const { data, error } = await pseSendInvoiceAndPaymentLink(request, {
      paymentLink: linkToStore,
      amount,
      currency,
      doctor
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    if (data) {
      onRequestPatch?.(data as Partial<OpinionRequest> & { id: string });
      setPaymentLink(data.payment_link?.trim() || linkToStore);
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
    const { amount } = paymentQuote;
    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      onError(
        'Consultation fee is missing. Confirm a doctor is assigned and has a consultation charge on their profile.'
      );
      return;
    }
    const currency = normalizeConsultationCurrency(
      paymentCurrency ?? (isHomeCare ? 'INR' : undefined)
    );
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

  const handleConfirmPayment = async (method: 'online' | 'cash' = 'online') => {
    const linkAmount = (() => {
      const trimmed = paymentLink.trim();
      if (!trimmed) return null;
      try {
        const url = new URL(trimmed);
        const raw = url.searchParams.get('amount');
        if (raw != null && raw.trim()) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
      } catch {
        /* ignore */
      }
      return null;
    })();

    const manualAmount = (() => {
      const parsed = Number(homeCareCashAmount);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })();

    const chargeAmount =
      (request.payment_amount != null && Number.isFinite(Number(request.payment_amount))
        ? Number(request.payment_amount)
        : null) ??
      (request.invoice_total != null && Number.isFinite(Number(request.invoice_total))
        ? Number(request.invoice_total)
        : null) ??
      linkAmount ??
      (isHomeCare ? manualAmount : null) ??
      paymentQuote.amount ??
      payableAmountForLink;

    if (chargeAmount == null || !Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      onError(
        isHomeCare
          ? 'Enter the amount received (or include amount= in the payment link) before confirming payment.'
          : 'Consultation fee is missing. Confirm a doctor is assigned and has a consultation charge on their profile.'
      );
      return;
    }

    const reference =
      method === 'cash'
        ? paymentReference.trim() || 'Cash received'
        : paymentReference.trim() || null;

    setBusy(true);

    if (isHomeCare) {
      const { data, error } = await pseConfirmHomeCarePayment(request, {
        amount: chargeAmount,
        currency: normalizeConsultationCurrency(
          paymentCurrency ??
            request.payment_currency ??
            request.consultation_currency ??
            'INR'
        ),
        reference,
        method
      });
      setBusy(false);
      if (error) {
        onError(error.message);
        return;
      }
      if (data) {
        onRequestPatch?.(data as Partial<OpinionRequest> & { id: string });
        if (data.payment_amount != null) {
          setHomeCareCashAmount(String(data.payment_amount));
        }
      }
      onSuccess(
        method === 'cash'
          ? 'Invoice generated and cash payment confirmed for the patient.'
          : 'Invoice generated and payment confirmed for the patient.'
      );
      onUpdated();
      setExpandedStepTracked(2);
      return;
    }

    const { error } = await pseConfirmPayment(request.id, {
      amount: chargeAmount,
      currency: normalizeConsultationCurrency(
        paymentCurrency ??
          request.payment_currency ??
          request.consultation_currency ??
          'USD'
      ),
      reference
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onSuccess(method === 'cash' ? 'Cash payment confirmed.' : 'Payment confirmed.');
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

  const homeCareAlreadyCompleted =
    request.consultation_stage === 'completed' || request.status === 'closed';

  const completeHomeCareRequest = async () => {
    setBusy(true);
    const { data, error } = await pseCompleteHomeCareRequest(request.id, {
      remarks: homeCareRemarks,
      followupDate: homeCareFollowupDate || null
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onRequestPatch?.({
      id: request.id,
      status: data?.status ?? 'closed',
      consultation_stage: data?.consultation_stage ?? 'completed',
      home_care_remarks: data?.home_care_remarks ?? null,
      home_care_followup_date: data?.home_care_followup_date ?? null
    });
    onSuccess('Home care request completed.');
    onUpdated();
  };

  const renderStepContent = (index: number) => {
    if (isHomeCare) {
      if (index === 0) {
        const services = homeCareServicesFromRequest(request);
        return (
          <Stack gap='sm' className='request-workflow-step'>
            <Text fw={600} size='sm'>
              Step 1 — Request from patient
            </Text>
            <Text size='sm'>
              <Text span fw={600}>
                Service type:{' '}
              </Text>
              Home Care
            </Text>
            {services.length > 0 ? (
              <Stack gap={4}>
                <Text size='sm' fw={600}>
                  Requested services
                </Text>
                {services.map((service) => (
                  <Text key={service} size='sm'>
                    • {service}
                  </Text>
                ))}
              </Stack>
            ) : null}
            <Text size='sm' c='dimmed'>
              Submitted {formatRequestDate(request.created_at)}
            </Text>
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
                Continue to payment →
              </Button>
            ) : null}
          </Stack>
        );
      }

      if (index === 1) {
        // Payment step
        return (
          <PsePaymentStepPanel
            request={request}
            paymentLink={paymentLink}
            paymentAmount={
              request.payment_amount != null && Number.isFinite(Number(request.payment_amount))
                ? Number(request.payment_amount)
                : payableAmountForLink
            }
            paymentCurrency={paymentCurrency}
            paymentReference={paymentReference}
            paymentLinkPlaceholder={autoPaymentLink || ELIX_EXTERNAL_PAYMENT_BASE_URL}
            busy={busy}
            readOnly={!canCoordinate}
            cashAmountInput={homeCareCashAmount}
            onCashAmountInputChange={handleHomeCareAmountChange}
            onPaymentLinkChange={handlePaymentLinkChange}
            onPaymentCurrencyChange={handlePaymentCurrencyChange}
            onPaymentReferenceChange={setPaymentReference}
            onSendInvoiceAndPaymentLink={() => void handleSendInvoiceAndPaymentLink()}
            onMarkPending={() => void handlePaymentPending()}
            onConfirmPayment={() => void handleConfirmPayment('online')}
            onConfirmCashPayment={() => void handleConfirmPayment('cash')}
            onReleaseToDoctor={() => void handleReleaseToDoctor()}
          />
        );
      }

      // Remarks & Complete Request (remarks + follow-up are optional)
      return (
        <Stack gap='sm' className='request-workflow-step'>
          <Text fw={600} size='sm'>
            Step 3 — Remarks & Complete Request
          </Text>
          <Text size='sm' c='dimmed'>
            Add optional remarks for the patient. You can complete the request with or without
            remarks. A follow-up date is not required.
          </Text>
          {canCoordinate && !homeCareAlreadyCompleted ? (
            <>
              <Textarea
                label='Remarks (Optional)'
                placeholder='Add remarks for the patient...'
                minRows={3}
                radius='md'
                value={homeCareRemarks}
                onChange={(event) => setHomeCareRemarks(event.currentTarget.value)}
                disabled={busy}
              />
              <DatePickerInput
                label='Follow-up Date (Optional)'
                placeholder='dd-mm-yyyy'
                clearable
                radius='md'
                valueFormat='DD-MM-YYYY'
                value={homeCareFollowupDate ? dayjs(homeCareFollowupDate).toDate() : null}
                onChange={(date) =>
                  setHomeCareFollowupDate(date ? dayjs(date).format('YYYY-MM-DD') : '')
                }
                disabled={busy}
                dropdownType={isCompactViewport ? 'modal' : 'popover'}
                leftSection={<IconCalendar size={16} stroke={1.75} />}
                popoverProps={{ withinPortal: true, zIndex: 400 }}
              />
              <Button
                color='cyan'
                radius='md'
                loading={busy}
                onClick={() => void completeHomeCareRequest()}
              >
                Complete Request
              </Button>
            </>
          ) : (
            <Stack gap={4}>
              {homeCareAlreadyCompleted ? (
                <Text size='sm' c='teal' fw={600}>
                  Request completed
                </Text>
              ) : null}
              <Text size='sm'>
                <Text span fw={600}>
                  Remarks:{' '}
                </Text>
                {request.home_care_remarks?.trim() || '—'}
              </Text>
              <Text size='sm'>
                <Text span fw={600}>
                  Follow-up date:{' '}
                </Text>
                {request.home_care_followup_date
                  ? dayjs(request.home_care_followup_date).format('DD-MM-YYYY')
                  : '—'}
              </Text>
            </Stack>
          )}
        </Stack>
      );
    }

    const contentIndex = index;

    switch (contentIndex) {
      case 0: {
        const services = homeCareServicesFromRequest(request);
        return (
          <Stack gap='sm' className='request-workflow-step'>
            <Text fw={600} size='sm'>
              Step 1 — Request from patient
            </Text>
            {isHomeCare ? (
              <>
                <Text size='sm'>
                  <Text span fw={600}>
                    Service type:{' '}
                  </Text>
                  Home Care
                </Text>
                {services.length > 0 ? (
                  <Stack gap={4}>
                    <Text size='sm' fw={600}>
                      Requested services
                    </Text>
                    {services.map((service) => (
                      <Text key={service} size='sm'>
                        • {service}
                      </Text>
                    ))}
                  </Stack>
                ) : null}
              </>
            ) : (
              <Text size='sm'>
                <Text span fw={600}>
                  {request.doctor_name ? 'Doctor requested: ' : 'Specialty requested: '}
                </Text>
                {request.doctor_name ?? request.requested_specialty ?? '—'}
                {request.doctor_specialty ? ` · ${request.doctor_specialty}` : ''}
              </Text>
            )}
            {!isHomeCare && request.consultation_fee_usd != null ? (
              <Text size='sm'>
                <Text span fw={600}>
                  Consultation charge:{' '}
                </Text>
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
            <Text size='sm' style={{ whiteSpace: 'pre-wrap' }}>
              {request.message}
            </Text>
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
      }
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
        const canUploadRecords = canCoordinate && canPseManageRequestRecords(request);
        return (
          <Stack gap='sm' className='request-workflow-step'>
            <Text size='xs' c='dimmed'>
              Open each file and confirm it matches the patient&apos;s case before recommending
              doctors.
            </Text>
            {canUploadRecords ? (
              <Button
                variant='light'
                color='cyan'
                radius='md'
                onClick={() => setShowUploadRecords(true)}
              >
                Upload records for patient
              </Button>
            ) : null}
            {request.patient_proceeded_without_records_at && !hasRecords ? (
              <Text size='sm' c='blue'>
                Patient chose to proceed without documents on{' '}
                {new Date(request.patient_proceeded_without_records_at).toLocaleString()}.
              </Text>
            ) : null}
            <PseRequestRecordsGallery
              records={request.records}
              requestId={request.id}
              onOpenDocument={(path, requestId) => onOpenRecord(path, requestId)}
              onDeleteRecord={canUploadRecords ? (record) => void deleteRequestRecord(record) : undefined}
              deletingRecordId={deletingRecordId}
              lightboxModalZIndex={1100}
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
            paymentCurrency={paymentCurrency}
            paymentReference={paymentReference}
            paymentLinkPlaceholder={autoPaymentLink || ELIX_EXTERNAL_PAYMENT_BASE_URL}
            busy={busy}
            readOnly={!canCoordinate}
            onPaymentLinkChange={handlePaymentLinkChange}
            onPaymentCurrencyChange={handlePaymentCurrencyChange}
            onPaymentReferenceChange={setPaymentReference}
            onSendInvoiceAndPaymentLink={() => void handleSendInvoiceAndPaymentLink()}
            onMarkPending={() => void handlePaymentPending()}
            onConfirmPayment={() => void handleConfirmPayment('online')}
            onConfirmCashPayment={() => void handleConfirmPayment('cash')}
            onReleaseToDoctor={() => void handleReleaseToDoctor()}
          />
        );
      case 5: {
        const scheduleDoctor = resolveInvoiceDoctor(request, doctors);
        return canCoordinate ? (
          <Stack gap='md' className='request-workflow-step'>
            <AppointmentDateTimePicker
              value={scheduledAt}
              onChange={setScheduledAt}
              consultationHours={scheduleDoctor?.consultation_hours ?? null}
              intervalMinutes={scheduleDoctor?.scheduler_time_interval ?? 30}
            />
            <TextInput
              label='Meeting link'
              description='Optional — leave blank if this consultation has no video meeting.'
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
              {meetingLink.trim() ? 'Save schedule & meeting link' : 'Save schedule'}
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
      }
      case 6:
        return (
          <Stack gap='sm' className='request-workflow-step'>
            {hasConsultationSummary(summary) && summary ? (
              <ConsultationSummaryPdfView summary={summary} request={request} />
            ) : request.doctor_response?.trim() ? (
              <ConsultationSummaryPdfView
                summary={consultationSummaryFromDoctorResponse(request, request.doctor_response)}
                request={request}
              />
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
    <>
      <ConsultationWizardAccordion
        className='request-workflow-wizard patient-consultation-wizard--accordion'
        heading='Coordination workflow'
        subheading={
          isHomeCare
            ? 'Home care: request → payment → optional remarks & follow-up.'
            : 'Manage each step of this patient request.'
        }
        steps={wizardSteps}
        expandedIndex={expandedStep}
        suggestedIndex={suggestedStep}
        canNavigate={canNavigateStep}
        onToggle={toggleStep}
        renderPanel={renderStepContent}
      />
      <PseUploadRecordsModal
        open={showUploadRecords}
        requestId={request.id}
        onClose={() => setShowUploadRecords(false)}
        onSuccess={onSuccess}
        onError={onError}
        onUploaded={() => {
          onUpdated();
          void loadMeta();
        }}
      />
    </>
  );
}
