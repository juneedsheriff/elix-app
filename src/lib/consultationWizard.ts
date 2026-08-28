import type { Doctor } from '../types/doctor';
import type {
  ConsultationSummary,
  OpinionRequest,
  OpinionRequestRecommendation
} from '../types/opinionRequest';
import { normalizeConsultationCurrency } from './consultationCurrency';
import {
  doctorConsultationCurrency,
  getPrimaryConsultationFeeUsd,
  getTierFeeFromTiers,
  getTierFeeUsd,
  normalizeConsultationDurationMinutes
} from './consultationTiers';
import { isHomeCareOpinionRequest } from './homeCareServices';

export type WizardAudience = 'pse' | 'patient';

export type WizardStepState = 'complete' | 'current' | 'upcoming';

export type WizardStepDef = {
  id: number;
  title: string;
  subtitle: string;
};

export const PSE_WIZARD_STEPS: WizardStepDef[] = [
  { id: 1, title: 'Request received', subtitle: 'Patient submitted a doctor consultation request' },
  { id: 2, title: 'Patient case details', subtitle: "Review the patient's submitted case information" },
  { id: 3, title: 'Verify records', subtitle: 'Review uploaded medical documents' },
  {
    id: 4,
    title: 'Recommend doctors',
    subtitle: 'Share doctors, review patient choice, confirm availability'
  },
  { id: 5, title: 'Send payment link', subtitle: 'After patient confirms schedule' },
  { id: 6, title: 'Schedule appointment', subtitle: 'Set date and time (meeting link optional)' },
  { id: 7, title: 'Consultation notes', subtitle: 'View doctor consultation summary' }
];

/** Home care coordination: request → payment → optional remarks/follow-up. */
export const HOME_CARE_PSE_WIZARD_STEPS: WizardStepDef[] = [
  {
    id: 1,
    title: 'Request received',
    subtitle: 'Patient submitted a home care services request'
  },
  {
    id: 2,
    title: 'Send payment link',
    subtitle: 'Collect payment for home care services'
  },
  {
    id: 3,
    title: 'Remarks & Complete Request',
    subtitle: 'Add optional remarks, then complete the home care request'
  }
];

/** Maps home-care accordion index → full PSE wizard content index (payment reuses step 5 / index 4). */
export const HOME_CARE_PSE_CONTENT_INDEX = [0, 4, -1] as const;

export const PATIENT_WIZARD_STEPS: WizardStepDef[] = [
  { id: 1, title: 'Request doctor consultation', subtitle: 'Review your submitted case details' },
  { id: 2, title: 'Document verification', subtitle: 'We verify your uploaded records' },
  { id: 3, title: 'Recommended doctors', subtitle: 'Choose from doctors curated for you' },
  { id: 4, title: 'Payment', subtitle: 'Complete payment to continue' },
  { id: 5, title: 'Scheduled appointment', subtitle: 'Your consultation date and time' },
  { id: 6, title: 'Consultation notes', subtitle: 'Summary from your doctor after the visit' }
];

/** Patient home care: services requested + payment only. */
export const HOME_CARE_PATIENT_WIZARD_STEPS: WizardStepDef[] = [
  {
    id: 1,
    title: 'Home care request',
    subtitle: 'Services you requested from your clinic'
  },
  {
    id: 2,
    title: 'Payment',
    subtitle: 'Complete payment when your clinic sends a link'
  }
];

export type WizardProgressContext = {
  request: OpinionRequest;
  recommendationsCount: number;
  hasSummary: boolean;
};

export function isPseHomeCareWizard(request: Pick<OpinionRequest, 'requested_specialty' | 'patient_case_details' | 'message'>) {
  return isHomeCareOpinionRequest(request);
}

export function isPatientHomeCareWizard(
  request: Pick<OpinionRequest, 'requested_specialty' | 'patient_case_details' | 'message'>
) {
  return isHomeCareOpinionRequest(request);
}

function wizardStepDefs(audience: WizardAudience, ctx: WizardProgressContext): WizardStepDef[] {
  if (audience === 'pse' && isPseHomeCareWizard(ctx.request)) {
    return HOME_CARE_PSE_WIZARD_STEPS;
  }
  if (audience === 'patient' && isPatientHomeCareWizard(ctx.request)) {
    return HOME_CARE_PATIENT_WIZARD_STEPS;
  }
  return audience === 'pse' ? PSE_WIZARD_STEPS : PATIENT_WIZARD_STEPS;
}

function wizardStepCount(audience: WizardAudience, ctx: WizardProgressContext) {
  return wizardStepDefs(audience, ctx).length;
}

function isRecordsVerified(request: OpinionRequest) {
  return Boolean(request.records_verified_at);
}

export function hasPatientProceededWithoutRecords(request: OpinionRequest) {
  return Boolean(request.patient_proceeded_without_records_at);
}

function isPseRecordsStepComplete(request: OpinionRequest) {
  return isRecordsVerified(request) || Boolean(request.pse_proceeded_without_records_at);
}

function isPatientDocumentStepComplete(request: OpinionRequest, recommendationsCount: number) {
  return (
    isRecordsVerified(request) ||
    hasPatientProceededWithoutRecords(request) ||
    isDoctorsShared(request, recommendationsCount)
  );
}

function isCaseDetailsReviewed(request: OpinionRequest) {
  return Boolean(request.case_details_reviewed_at);
}

function isDoctorsShared(request: OpinionRequest, recommendationsCount: number) {
  const stage = request.consultation_stage;
  if (
    stage === 'recommended' ||
    stage === 'doctor_selected' ||
    stage === 'availability_submitted' ||
    stage === 'schedule_proposed' ||
    stage === 'schedule_confirmed' ||
    stage === 'scheduled' ||
    stage === 'payment_pending' ||
    stage === 'paid' ||
    stage === 'completed'
  ) {
    return true;
  }
  return recommendationsCount > 0;
}

export function areDoctorsSharedWithPatient(request: OpinionRequest, recommendationsCount: number) {
  return isDoctorsShared(request, recommendationsCount);
}

const PAST_SELF_SELECT_AVAILABILITY_STAGES = new Set([
  'availability_submitted',
  'schedule_proposed',
  'schedule_confirmed',
  'scheduled',
  'payment_pending',
  'paid',
  'completed'
]);

/** Patient chose a doctor up front (self-select flow), not PSE recommendation-only. */
export function hasSelfSelectedDoctor(
  request: Pick<OpinionRequest, 'doctor_selection_mode' | 'doctor_id' | 'selected_doctor_id'>
): boolean {
  if (request.doctor_selection_mode === 'needs_recommendation') return false;
  if (request.doctor_selection_mode === 'self_select') return true;
  return Boolean(request.doctor_id || request.selected_doctor_id);
}

/** Self-select: show the chosen doctor while PSE checks availability (before alternatives are shared). */
export function isAwaitingPseAvailabilityForSelfSelectedDoctor(
  request: OpinionRequest,
  recommendationsCount: number
): boolean {
  if (!hasSelfSelectedDoctor(request)) return false;
  if (!request.doctor_name && !request.selected_doctor_id && !request.doctor_id) return false;
  if (recommendationsCount > 0) return false;
  if (request.consultation_stage === 'recommended') return false;
  return !PAST_SELF_SELECT_AVAILABILITY_STAGES.has(request.consultation_stage ?? '');
}

export function isScheduleConfirmed(request: OpinionRequest) {
  const stage = request.consultation_stage;
  return (
    stage === 'schedule_confirmed' ||
    stage === 'payment_pending' ||
    stage === 'paid' ||
    stage === 'scheduled' ||
    stage === 'completed' ||
    Boolean(request.schedule_confirmed_at)
  );
}

/** PSE may send a payment link once the patient has confirmed (or submitted) the schedule. */
export function canPseSendPaymentLink(request: OpinionRequest) {
  if (isPseHomeCareWizard(request)) return true;
  if (isScheduleConfirmed(request)) return true;
  return (
    request.consultation_stage === 'availability_submitted' &&
    Boolean(request.selected_doctor_id || request.doctor_name) &&
    request.patient_availability != null
  );
}

/** Patient finished doctor choice and submitted availability (PSE should review). */
export function isPatientSelectionAwaitingPseReview(request: OpinionRequest) {
  const stage = request.consultation_stage;
  return stage === 'doctor_selected' || stage === 'availability_submitted';
}

/** PSE may approve the patient's doctor choice to unlock the payment step. */
export function canPseApprovePatientSelection(request: OpinionRequest) {
  const hasPatientDoctor = Boolean(
    request.doctor_name || request.selected_doctor_id || request.doctor_id
  );
  if (!hasPatientDoctor) return false;
  return !isScheduleConfirmed(request);
}

function isPaymentConfirmed(request: OpinionRequest) {
  return request.payment_status === 'paid';
}

function isAppointmentScheduled(request: OpinionRequest) {
  return Boolean(request.scheduled_at?.trim());
}

export function isPatientPaymentConfirmed(request: OpinionRequest) {
  return request.payment_status === 'paid';
}

/** Payment link sent; patient must pay before the appointment step unlocks. */
export function hasPatientPaymentDue(request: OpinionRequest) {
  return Boolean(request.payment_link?.trim()) && !isPatientPaymentConfirmed(request);
}

/** Payment started in workflow but link not loaded in UI yet (refresh usually fixes). */
export function isPatientPaymentLinkPending(request: OpinionRequest) {
  return (
    !isPatientPaymentConfirmed(request) &&
    !hasPatientPaymentDue(request) &&
    (request.payment_status === 'pending' || request.consultation_stage === 'payment_pending')
  );
}

/** Patient may use the appointment step only after payment is confirmed. */
export function isPatientAppointmentPhase(request: OpinionRequest) {
  if (!isPatientPaymentConfirmed(request)) return false;
  const stage = request.consultation_stage;
  return stage === 'paid' || stage === 'scheduled' || stage === 'completed';
}

export function isPaymentAccessible(request: OpinionRequest) {
  return (
    request.payment_status === 'paid' ||
    request.payment_status === 'pending' ||
    request.consultation_stage === 'payment_pending' ||
    Boolean(request.payment_link?.trim())
  );
}

function isStepComplete(index: number, ctx: WizardProgressContext, audience: WizardAudience): boolean {
  const { request, recommendationsCount, hasSummary } = ctx;

  if (audience === 'pse' && isPseHomeCareWizard(request)) {
    switch (index) {
      case 0:
        return true;
      case 1:
        return isPaymentConfirmed(request);
      case 2:
        return (
          request.consultation_stage === 'completed' || request.status === 'closed'
        );
      default:
        return false;
    }
  }

  if (audience === 'patient' && isPatientHomeCareWizard(request)) {
    switch (index) {
      case 0:
        return true;
      case 1:
        return isPaymentConfirmed(request);
      default:
        return false;
    }
  }

  if (audience === 'pse') {
    switch (index) {
      case 0:
        return true;
      case 1:
        return isCaseDetailsReviewed(request);
      case 2:
        return isPseRecordsStepComplete(request);
      case 3:
        return isScheduleConfirmed(request);
      case 4:
        return isPaymentConfirmed(request);
      case 5:
        return isAppointmentScheduled(request);
      case 6:
        return isConsultationNotesComplete(ctx);
      default:
        return false;
    }
  }

  switch (index) {
    case 0:
      return true;
    case 1:
      return isPatientDocumentStepComplete(request, recommendationsCount);
    case 2:
      return isScheduleConfirmed(request);
    case 3:
      return isPaymentConfirmed(request);
    case 4:
      return (
        hasSummary ||
        request.consultation_stage === 'completed' ||
        (isPaymentConfirmed(request) && isAppointmentScheduled(request))
      );
    case 5:
      return isPatientConsultationNotesComplete(ctx);
    default:
      return false;
  }
}

/** Highest step index (0-based) that is fully complete. */
export function getMaxCompletedStepIndex(ctx: WizardProgressContext, audience: WizardAudience = 'patient'): number {
  let max = -1;
  const count = wizardStepCount(audience, ctx);
  for (let i = 0; i < count; i += 1) {
    if (isStepComplete(i, ctx, audience)) max = i;
  }
  return max;
}

/** First step that still needs work; used as default selection. */
export function getSuggestedActiveStep(ctx: WizardProgressContext, audience: WizardAudience = 'patient'): number {
  if (audience === 'pse' && isPseHomeCareWizard(ctx.request)) {
    if (ctx.request.consultation_stage === 'completed' || ctx.request.status === 'closed') {
      return 2;
    }
    if (isPaymentConfirmed(ctx.request)) return 2;
    if (
      hasPatientPaymentDue(ctx.request) ||
      ctx.request.consultation_stage === 'payment_pending' ||
      ctx.request.payment_status === 'pending'
    ) {
      return 1;
    }
    return 0;
  }

  if (audience === 'patient' && isPatientHomeCareWizard(ctx.request)) {
    if (isPaymentConfirmed(ctx.request)) return 1;
    if (
      hasPatientPaymentDue(ctx.request) ||
      ctx.request.consultation_stage === 'payment_pending' ||
      ctx.request.payment_status === 'pending'
    ) {
      return 1;
    }
    return 0;
  }

  const max = getMaxCompletedStepIndex(ctx, audience);
  const lastIndex = wizardStepCount(audience, ctx) - 1;
  let suggested = Math.min(max + 1, lastIndex);

  if (audience === 'pse') {
    const stage = ctx.request.consultation_stage;
    if (stage === 'availability_submitted' || stage === 'doctor_selected' || stage === 'schedule_proposed') {
      suggested = Math.max(suggested, 3);
    }
    if (stage === 'schedule_confirmed') {
      suggested = Math.max(suggested, 4);
    }
    if (isConsultationNotesComplete(ctx)) {
      suggested = lastIndex;
    }
  }

  if (
    audience === 'patient' &&
    areDoctorsSharedWithPatient(ctx.request, ctx.recommendationsCount) &&
    suggested < 2
  ) {
    suggested = 2;
  }

  if (audience === 'patient' && ctx.request.consultation_stage === 'schedule_proposed') {
    suggested = 2;
  }

  if (audience === 'patient') {
    if (isPatientConsultationNotesComplete(ctx)) {
      suggested = 5;
    } else if (isPatientAppointmentPhase(ctx.request)) {
      suggested = 4;
    } else if (
      hasPatientPaymentDue(ctx.request) ||
      ctx.request.consultation_stage === 'payment_pending' ||
      ctx.request.payment_status === 'pending'
    ) {
      suggested = Math.max(suggested, 3);
    }
  }

  return suggested;
}

export function getWizardSteps(
  audience: WizardAudience,
  ctx: WizardProgressContext,
  activeIndex: number
): Array<WizardStepDef & { state: WizardStepState }> {
  const defs = wizardStepDefs(audience, ctx);

  return defs.map((step, index) => {
    let state: WizardStepState = 'upcoming';
    if (isStepComplete(index, ctx, audience)) {
      state = 'complete';
    } else if (index === activeIndex) {
      state = 'current';
    }
    return { ...step, state };
  });
}

/** PSE may open any step up through the next actionable step. */
export function canPseNavigateToStep(targetIndex: number, ctx: WizardProgressContext): boolean {
  const lastIndex = wizardStepCount('pse', ctx) - 1;
  if (targetIndex < 0 || targetIndex > lastIndex) return false;
  const maxCompleted = getMaxCompletedStepIndex(ctx, 'pse');
  return targetIndex <= maxCompleted + 1;
}

/** Patient may open completed steps and the current actionable step (unlocked by PSE actions). */
export function canPatientNavigateToStep(targetIndex: number, ctx: WizardProgressContext): boolean {
  if (targetIndex === 0) return true;
  if (isPatientHomeCareWizard(ctx.request)) {
    const maxCompleted = getMaxCompletedStepIndex(ctx, 'patient');
    const suggested = getSuggestedActiveStep(ctx, 'patient');
    return targetIndex <= maxCompleted || targetIndex === suggested;
  }
  const maxCompleted = getMaxCompletedStepIndex(ctx, 'patient');
  const suggested = getSuggestedActiveStep(ctx, 'patient');
  if (targetIndex <= maxCompleted || targetIndex === suggested) return true;
  if (targetIndex === 2 && areDoctorsSharedWithPatient(ctx.request, ctx.recommendationsCount)) {
    return true;
  }
  if (targetIndex === 4 && isPatientAppointmentPhase(ctx.request)) return true;
  if (targetIndex === 5 && isPatientConsultationNotesComplete(ctx)) return true;
  return false;
}

const pseWizardStepStorageKey = (requestId: string) => `elix:pse-wizard-step:${requestId}`;
const patientWizardStepStorageKey = (requestId: string) => `elix:patient-wizard-step:${requestId}`;

export function readPatientWizardStoredStep(requestId: string): number | null {
  try {
    const raw = sessionStorage.getItem(patientWizardStepStorageKey(requestId));
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writePatientWizardStoredStep(requestId: string, step: number) {
  try {
    sessionStorage.setItem(patientWizardStepStorageKey(requestId), String(step));
  } catch {
    /* ignore */
  }
}

function initialPatientWizardStep(
  requestId: string,
  suggestedStep: number,
  maxNavigableStep: number,
  ctx: WizardProgressContext
) {
  const stored = readPatientWizardStoredStep(requestId);
  let step = Math.max(stored ?? suggestedStep, suggestedStep);
  if (isPatientHomeCareWizard(ctx.request)) {
    if (hasPatientPaymentDue(ctx.request)) {
      step = Math.min(step, 1);
    }
    return clampWizardStep(step, maxNavigableStep);
  }
  if (hasPatientPaymentDue(ctx.request)) {
    step = Math.min(step, 3);
  } else if (isPatientPaymentConfirmed(ctx.request) && isPatientAppointmentPhase(ctx.request) && !ctx.hasSummary) {
    step = Math.max(step, 4);
  }
  return clampWizardStep(step, maxNavigableStep);
}

export function getInitialPatientWizardStep(ctx: WizardProgressContext) {
  const suggested = getSuggestedActiveStep(ctx, 'patient');
  const maxNav = getMaxCompletedStepIndex(ctx, 'patient') + 1;
  return initialPatientWizardStep(ctx.request.id, suggested, maxNav, ctx);
}

export function readPseWizardStoredStep(requestId: string): number | null {
  try {
    const raw = sessionStorage.getItem(pseWizardStepStorageKey(requestId));
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writePseWizardStoredStep(requestId: string, step: number) {
  try {
    sessionStorage.setItem(pseWizardStepStorageKey(requestId), String(step));
  } catch {
    /* ignore */
  }
}

function clampWizardStep(step: number, maxNavigableStep: number) {
  return Math.min(Math.max(0, step), Math.max(0, maxNavigableStep));
}

/** First open starts at step 1 (index 0); reopening the same request restores the last step. */
function initialPseWizardStep(requestId: string, maxNavigableStep: number) {
  const stored = readPseWizardStoredStep(requestId);
  if (stored != null) {
    return clampWizardStep(stored, maxNavigableStep);
  }
  return 0;
}

/** Keep wizard step on refresh; only move forward when a new step unlocks. */
export function resolveWizardStepOnUpdate(
  requestId: string,
  suggestedStep: number,
  state: { requestId: string | null; step: number | null; lastSuggested: number },
  options?: {
    audience?: WizardAudience;
    maxNavigableStep?: number;
    progressCtx?: WizardProgressContext;
  }
): { requestId: string; step: number; lastSuggested: number } {
  if (options?.audience === 'pse') {
    const maxNav = options.maxNavigableStep ?? suggestedStep;

    if (state.requestId !== requestId || state.step === null) {
      const step = initialPseWizardStep(requestId, maxNav);
      writePseWizardStoredStep(requestId, step);
      return { requestId, step, lastSuggested: suggestedStep };
    }

    if (suggestedStep > state.lastSuggested) {
      const stored = readPseWizardStoredStep(requestId);
      // First visit always opens on step 1; do not auto-skip ahead until PSE has progressed before.
      if (stored != null && stored > 0) {
        const step = clampWizardStep(Math.max(suggestedStep, state.step ?? 0), maxNav);
        writePseWizardStoredStep(requestId, step);
        return { requestId, step, lastSuggested: suggestedStep };
      }
      return {
        requestId,
        step: clampWizardStep(state.step ?? 0, maxNav),
        lastSuggested: suggestedStep
      };
    }

    const step = clampWizardStep(state.step ?? 0, maxNav);
    return { requestId, step, lastSuggested: suggestedStep };
  }

  if (options?.audience === 'patient') {
    const maxNav = options.maxNavigableStep ?? suggestedStep;
    const ctx = options.progressCtx;

    if (state.requestId !== requestId || state.step === null) {
      const stored = readPatientWizardStoredStep(requestId);
      const step =
        stored != null
          ? clampWizardStep(stored, maxNav)
          : 0;
      writePatientWizardStoredStep(requestId, step);
      return { requestId, step, lastSuggested: suggestedStep };
    }

    if (suggestedStep > state.lastSuggested) {
      const step = clampWizardStep(suggestedStep, maxNav);
      writePatientWizardStoredStep(requestId, step);
      return { requestId, step, lastSuggested: suggestedStep };
    }

    let step = clampWizardStep(state.step, maxNav);
    if (ctx?.request && isPatientHomeCareWizard(ctx.request) && hasPatientPaymentDue(ctx.request) && step > 1) {
      step = 1;
      writePatientWizardStoredStep(requestId, step);
    } else if (ctx?.request && hasPatientPaymentDue(ctx.request) && step > 3) {
      step = 3;
      writePatientWizardStoredStep(requestId, step);
    } else if (
      ctx &&
      !isPatientHomeCareWizard(ctx.request) &&
      isPatientPaymentConfirmed(ctx.request) &&
      isPatientAppointmentPhase(ctx.request) &&
      !ctx.hasSummary &&
      step < 4
    ) {
      step = 4;
      writePatientWizardStoredStep(requestId, step);
    }
    return { requestId, step, lastSuggested: suggestedStep };
  }

  if (state.requestId !== requestId) {
    return { requestId, step: suggestedStep, lastSuggested: suggestedStep };
  }
  if (state.step === null) {
    return { requestId, step: suggestedStep, lastSuggested: suggestedStep };
  }
  if (suggestedStep > state.lastSuggested) {
    return { requestId, step: suggestedStep, lastSuggested: suggestedStep };
  }
  return { requestId, step: state.step, lastSuggested: suggestedStep };
}

export function getInitialPseWizardStep(ctx: WizardProgressContext) {
  const lastIndex = Math.max(0, wizardStepCount('pse', ctx) - 1);
  const maxNav = Math.min(getMaxCompletedStepIndex(ctx, 'pse') + 1, lastIndex);
  return initialPseWizardStep(ctx.request.id, maxNav);
}

/** Amount and currency the patient should pay — from the doctor's quoted consultation fee. */
export function resolvePsePaymentQuote(
  request: OpinionRequest,
  doctors: Doctor[] = [],
  recommendations: OpinionRequestRecommendation[] = []
): { amount: number | null; currency: ReturnType<typeof normalizeConsultationCurrency> } {
  if (isPseHomeCareWizard(request)) {
    const paymentAmount = Number(request.payment_amount);
    return {
      amount: Number.isFinite(paymentAmount) && paymentAmount > 0 ? paymentAmount : null,
      currency: normalizeConsultationCurrency(request.payment_currency ?? 'INR')
    };
  }

  const durationMinutes = normalizeConsultationDurationMinutes(request.consultation_duration_minutes);
  const storedFee = Number(request.consultation_fee_usd);
  if (Number.isFinite(storedFee) && storedFee > 0) {
    return {
      amount: storedFee,
      currency: normalizeConsultationCurrency(request.consultation_currency)
    };
  }

  const doctorId = request.selected_doctor_id ?? request.doctor_id;
  if (doctorId) {
    const recommendation = recommendations.find((item) => item.doctor_id === doctorId);
    const recommendationFee =
      durationMinutes != null
        ? getTierFeeFromTiers(recommendation?.doctor_consultation_tiers, durationMinutes)
        : null;
    if (recommendationFee != null) {
      return {
        amount: recommendationFee,
        currency: normalizeConsultationCurrency(recommendation?.doctor_consultation_currency)
      };
    }

    const doctor = doctors.find((item) => item.id === doctorId);
    if (doctor) {
      const fee =
        durationMinutes != null ? getTierFeeUsd(doctor, durationMinutes) : null;
      const resolved =
        fee != null && Number.isFinite(fee)
          ? fee
          : (() => {
              const tiers = recommendation?.doctor_consultation_tiers;
              if (tiers?.length) {
                const fromTiers =
                  getTierFeeFromTiers(tiers, 30) ??
                  tiers.find((t) => t.fee_usd > 0)?.fee_usd;
                if (fromTiers != null && fromTiers > 0) return fromTiers;
              }
              return getPrimaryConsultationFeeUsd(doctor);
            })();
      if (resolved != null && Number.isFinite(resolved) && resolved > 0) {
        return {
          amount: resolved,
          currency: doctorConsultationCurrency(doctor)
        };
      }
    }
  }

  const paymentAmount = Number(request.payment_amount);
  if (Number.isFinite(paymentAmount) && paymentAmount > 0) {
    return {
      amount: paymentAmount,
      currency: normalizeConsultationCurrency(
        request.payment_currency ?? request.consultation_currency
      )
    };
  }

  return {
    amount: null,
    currency: normalizeConsultationCurrency(request.consultation_currency)
  };
}

export function hasConsultationSummary(summary: ConsultationSummary | null | undefined): boolean {
  if (!summary) return false;
  return Boolean(
    summary.pdf_storage_path?.trim() ||
      summary.chief_complaint?.trim() ||
      summary.history_present_illness?.trim() ||
      summary.vital_signs?.trim() ||
      summary.current_medications?.trim() ||
      summary.past_medical_history?.trim() ||
      summary.labs_diagnostics?.trim() ||
      summary.assessment_plan?.trim() ||
      summary.followup_date?.trim() ||
      summary.prescription?.trim() ||
      summary.prescription_file_path?.trim() ||
      summary.lab_order_file_path?.trim()
  );
}

/** Consultation notes step — doctor has submitted notes or the case is closed. */
export function isConsultationNotesComplete(ctx: WizardProgressContext): boolean {
  const { request, hasSummary } = ctx;
  return (
    hasSummary ||
    request.consultation_stage === 'completed' ||
    request.status === 'closed' ||
    Boolean(request.doctor_response?.trim())
  );
}

/** Patient step 6 — doctor has submitted consultation notes. */
export function isPatientConsultationNotesComplete(ctx: WizardProgressContext): boolean {
  return isConsultationNotesComplete(ctx);
}
