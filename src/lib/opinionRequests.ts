import type {
  ConsultationStage,
  ConsultationSummary,
  DoctorSelectionMode,
  OpinionRequest,
  OpinionRequestFile,
  OpinionRequestRecommendation,
  OpinionRequestStatus,
  PaymentStatus
} from '../types/opinionRequest';
import type { Doctor } from '../types/doctor';
import { normalizeConsultationCurrency } from './consultationCurrency';
import {
  buildConsultationInvoiceNumber,
  computeConsultationInvoiceTotals,
  generateConsultationInvoicePdfBlob
} from './consultationInvoicePdf';
import { doctorConsultationCurrency, getTierFeeUsd, parseConsultationTiers } from './consultationTiers';
import { isDoctorAvailableToClinic } from './clinicDoctorRequests';
import { fetchDoctorByAuthUserId, fetchDoctorById, normalizeDoctor } from './doctors';
import { fetchPatientByAuthUserId } from './patients';
import {
  consultationSummaryPdfMetaFromRequest,
  generateConsultationSummaryPdfBlob
} from './consultationSummaryPdf';
import {
  createConsultationInvoiceUploadUrl,
  createConsultationSummaryUploadUrl,
  createR2UploadUrl,
  isR2StorageConfigured,
  uploadFileToR2
} from './r2Storage';
import { supabase } from './supabase';
import { ensureFreshAccessToken, normalizeStorageAuthError } from './supabaseSession';
import {
  recordOpinionRequestAudit,
  type OpinionRequestAuditAction,
  type OpinionRequestAuditActorRole
} from './opinionRequestAudit';

const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PAYMENT_PROOF_ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
]);

const workflowFieldsScheduling = `
  payment_link,
  pse_scheduling_message,
  schedule_confirmed_at
`;

const workflowFieldsPaymentProof = `
  payment_proof_storage_path,
  payment_proof_file_name,
  payment_proof_mime_type,
  payment_proof_submitted_at
`;

const workflowFieldsExtended = `
  ${workflowFieldsScheduling},
  ${workflowFieldsPaymentProof}
`;

/** Migration 019 workflow columns (always required for consultation flow). */
const workflowFieldsCore = `
  consultation_stage,
  selected_doctor_id,
  patient_availability,
  scheduled_at,
  meeting_link,
  payment_status,
  payment_amount,
  payment_currency,
  payment_reference,
  payment_confirmed_at,
  consultation_duration_minutes,
  consultation_fee_usd,
  consultation_currency
`;

const workflowFieldsInvoice = `
  invoice_pdf_storage_path,
  invoice_generated_at,
  invoice_number,
  invoice_subtotal,
  invoice_tax_rate,
  invoice_tax_amount,
  invoice_total
`;

const workflowFields = `
  ${workflowFieldsCore},
  records_verified_at,
  case_details_reviewed_at,
  records_rejected_at,
  records_rejection_reason,
  patient_proceeded_without_records_at,
  pse_proceeded_without_records_at,
  patient_case_details,
  ${workflowFieldsInvoice},
  ${workflowFieldsExtended}
`;

function stripRecordsVerifiedFromSelect(select: string) {
  return select.replace(/,?\s*records_verified_at\s*/g, '');
}

function stripDoctorSelectionModeFromSelect(select: string) {
  return select.replace(/,?\s*doctor_selection_mode\s*/g, '');
}

function stripRequestedSpecialtyFromSelect(select: string) {
  return select.replace(/,?\s*requested_specialty\s*/g, '');
}

function stripPaymentProofFromSelect(select: string) {
  return select
    .replace(/,?\s*payment_proof_storage_path\s*/g, '')
    .replace(/,?\s*payment_proof_file_name\s*/g, '')
    .replace(/,?\s*payment_proof_mime_type\s*/g, '')
    .replace(/,?\s*payment_proof_submitted_at\s*/g, '');
}

function stripInvoiceFromSelect(select: string) {
  return select
    .replace(/,?\s*invoice_pdf_storage_path\s*/g, '')
    .replace(/,?\s*invoice_generated_at\s*/g, '')
    .replace(/,?\s*invoice_number\s*/g, '')
    .replace(/,?\s*invoice_subtotal\s*/g, '')
    .replace(/,?\s*invoice_tax_rate\s*/g, '')
    .replace(/,?\s*invoice_tax_amount\s*/g, '')
    .replace(/,?\s*invoice_total\s*/g, '');
}

function stripSchedulingFromSelect(select: string) {
  return select
    .replace(/,?\s*payment_link\s*/g, '')
    .replace(/,?\s*pse_scheduling_message\s*/g, '')
    .replace(/,?\s*schedule_confirmed_at\s*/g, '');
}

/** @deprecated Use stripPaymentProofFromSelect / stripSchedulingFromSelect */
function stripExtendedWorkflowFromSelect(select: string) {
  return stripSchedulingFromSelect(stripPaymentProofFromSelect(stripRecordsVerifiedFromSelect(select)));
}

const requestListSelectBase = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_selection_mode,
  requested_specialty,
  ${workflowFields},
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

/** Lightweight select for dashboards when nested joins fail */
const requestListSelectMinimal = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  ${workflowFields},
  doctor_response,
  responded_at
`;

const requestListSelectMinimalBase = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name
`;

const assignmentFields = `
  assigned_to,
  assigned_at,
  coordination_notes,
  assignee:admins!opinion_requests_assigned_to_fkey (
    full_name
  )
`;

const requestListSelectWithResponse = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_selection_mode,
  requested_specialty,
  ${workflowFields},
  doctor_response,
  responded_at,
  ${assignmentFields},
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

const requestListSelectWithResponseNoAssign = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  ${workflowFields},
  doctor_response,
  responded_at,
  assigned_to,
  assigned_at,
  coordination_notes,
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

/** Patient list — no staff assignee embed (RLS blocks admins join for patients). */
const requestListSelectPatient = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_selection_mode,
  requested_specialty,
  ${workflowFields},
  doctor_response,
  responded_at,
  assigned_to,
  assigned_at,
  coordination_notes,
  doctors (
    id,
    full_name,
    specialty
  )
`;

/** Selects without consultation workflow columns (pre-migration 019). */
const requestListSelectWithResponseLegacy = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_response,
  responded_at,
  ${assignmentFields},
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

const requestListSelectWithResponseNoAssignLegacy = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_response,
  responded_at,
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

const requestListSelectBaseLegacy = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctors (
    id,
    full_name,
    specialty
  ),
  opinion_request_records (
    uploaded_files (
      id,
      file_name,
      summary,
      storage_path
    )
  )
`;

const requestListSelectMinimalLegacy = `
  id,
  message,
  status,
  created_at,
  patient_id,
  patient_name,
  doctor_id,
  doctor_name,
  doctor_response,
  responded_at
`;

/** Patient-facing: waiting for a doctor opinion (no response text yet). */
export function isAwaitingDoctorReply(request: Pick<OpinionRequest, 'doctor_response'>): boolean {
  return !request.doctor_response?.trim();
}

/** Patient my-requests list: consultation finished or case closed. */
export function isPatientRequestCompleted(
  request: Pick<OpinionRequest, 'consultation_stage' | 'doctor_response' | 'status'>
): boolean {
  if (request.consultation_stage === 'completed') return true;
  if (request.doctor_response?.trim()) return true;
  return request.status === 'closed';
}

/** Request submitted by patient but not yet assigned by admin. */
export function isPendingAdminAssignment(
  request: Pick<OpinionRequest, 'status' | 'assigned_to'>
): boolean {
  return request.status === 'submitted' && !request.assigned_to;
}

/** @deprecated Use isPendingAdminAssignment */
export function isPendingAdminApproval(
  request: Pick<OpinionRequest, 'status' | 'assigned_to'>
): boolean {
  return isPendingAdminAssignment(request);
}

export function isAssignedToPatientService(
  request: Pick<OpinionRequest, 'status' | 'assigned_to'>
): boolean {
  return request.status === 'submitted' && Boolean(request.assigned_to);
}

export function consultationStageLabel(stage: ConsultationStage | null | undefined) {
  switch (stage) {
    case 'new':
      return 'New';
    case 'assigned':
      return 'Assigned to PSE';
    case 'recommended':
      return 'Doctors recommended';
    case 'doctor_selected':
      return 'Doctor selected';
    case 'availability_submitted':
      return 'Availability submitted';
    case 'schedule_proposed':
      return 'Schedule proposed';
    case 'schedule_confirmed':
      return 'Schedule confirmed';
    case 'scheduled':
      return 'Scheduled';
    case 'payment_pending':
      return 'Payment pending';
    case 'paid':
      return 'Paid';
    case 'completed':
      return 'Completed';
    default:
      return 'In progress';
  }
}

export function patientRequestStatusLabel(
  request: Pick<
    OpinionRequest,
    | 'status'
    | 'doctor_response'
    | 'assigned_to'
    | 'consultation_stage'
    | 'payment_status'
    | 'records_verified_at'
    | 'patient_proceeded_without_records_at'
    | 'doctor_id'
  >
): string {
  if (request.consultation_stage === 'completed' || request.doctor_response?.trim()) {
    return 'Consultation complete';
  }
  if (request.consultation_stage === 'paid') return 'Ready for consultation';
  if (request.consultation_stage === 'payment_pending') return 'Payment required';
  if (request.consultation_stage === 'schedule_confirmed') return 'Awaiting payment link';
  if (request.consultation_stage === 'schedule_proposed') return 'Confirm proposed schedule';
  if (request.consultation_stage === 'scheduled') return 'Appointment scheduled';
  if (request.consultation_stage === 'availability_submitted') return 'Checking availability';
  if (request.consultation_stage === 'doctor_selected') return 'Submit your availability';
  if (request.consultation_stage === 'recommended') return 'Choose a doctor';
  if (request.records_verified_at && !request.doctor_id) return 'Awaiting doctor recommendations';
  if (request.records_verified_at) return 'Documents verified';
  if (request.patient_proceeded_without_records_at) return 'Proceeding without documents';
  if (request.status === 'submitted' && !request.assigned_to) return 'Pending admin review';
  if (request.status === 'submitted' && request.assigned_to) return 'Being coordinated by our team';
  if (request.status === 'in_review') return 'Consultation in progress';
  if (request.status === 'closed') return 'Closed';
  return 'Submitted';
}

export function staffRequestStatusLabel(
  request: Pick<
    OpinionRequest,
    'status' | 'assigned_to' | 'doctor_response' | 'consultation_stage' | 'payment_status'
  >
): string {
  if (request.consultation_stage === 'completed' || request.status === 'closed') return 'Completed';
  if (request.consultation_stage) return consultationStageLabel(request.consultation_stage);
  if (request.doctor_response?.trim()) return 'Closed';
  if (request.status === 'in_review') return 'With doctor';
  if (request.status === 'submitted' && request.assigned_to) return 'With patient service';
  if (request.status === 'submitted') return 'Pending assignment';
  return request.status;
}

function isMissingAssignmentColumnsError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('assigned_to') || msg.includes('coordination_notes') || msg.includes('assignee');
}

function isMissingResponseColumnsError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('doctor_response') || msg.includes('responded_at');
}

function isMissingRecordsVerifiedColumnError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('records_verified_at');
}

function isMissingCaseDetailsReviewedColumnError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('case_details_reviewed_at');
}

function isMissingRecordsRejectedColumnError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('records_rejected_at') || msg.includes('records_rejection_reason');
}

function isMissingProceedWithoutRecordsColumnError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return (
    msg.includes('patient_proceeded_without_records_at') ||
    msg.includes('pse_proceeded_without_records_at')
  );
}

function isMissingPatientCaseDetailsColumnError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('patient_case_details');
}

function stripPatientCaseDetailsFromSelect(select: string) {
  return select
    .replace(/,?\s*patient_case_details\s*/g, '')
    .replace(/,?\s*case_details_reviewed_at\s*/g, '')
    .replace(/,?\s*records_rejected_at\s*/g, '')
    .replace(/,?\s*records_rejection_reason\s*/g, '');
}

function stripProceededWithoutRecordsFromSelect(select: string) {
  return select
    .replace(/,?\s*patient_proceeded_without_records_at\s*/g, '')
    .replace(/,?\s*pse_proceeded_without_records_at\s*/g, '');
}

function isMissingDoctorSelectionModeError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('doctor_selection_mode');
}

function isMissingRequestedSpecialtyError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('requested_specialty');
}

function isNullableDoctorIdBlocked(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return msg.includes('doctor_id') && (msg.includes('not-null') || msg.includes('null value'));
}

function recommendationMigrationHint() {
  return 'Run npm run db:apply-recommendation-opinion-requests, or paste supabase/migrations/029_recommendation_opinion_requests.sql and 030_requested_specialty.sql into the Supabase SQL Editor.';
}

function isMissingWorkflowColumnsError(error: { message?: string } | null) {
  const msg = error?.message?.toLowerCase() ?? '';
  return (
    msg.includes('consultation_stage') ||
    msg.includes('selected_doctor_id') ||
    msg.includes('patient_availability') ||
    msg.includes('scheduled_at') ||
    msg.includes('meeting_link') ||
    msg.includes('payment_status') ||
    msg.includes('payment_amount') ||
    msg.includes('payment_reference') ||
    msg.includes('payment_confirmed_at') ||
    msg.includes('payment_link') ||
    msg.includes('payment_proof_') ||
    msg.includes('pse_scheduling_message') ||
    msg.includes('schedule_confirmed_at') ||
    msg.includes('consultation_duration_minutes') ||
    msg.includes('consultation_fee_usd') ||
    msg.includes('consultation_currency') ||
    msg.includes('invoice_pdf_storage_path') ||
    msg.includes('invoice_generated_at') ||
    msg.includes('invoice_number') ||
    msg.includes('invoice_subtotal') ||
    msg.includes('invoice_tax')
  );
}

type RequestListRow = {
  id: string;
  message: string;
  status: string;
  created_at: string;
  patient_id: string | null;
  patient_name: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  doctor_selection_mode?: DoctorSelectionMode | null;
  requested_specialty?: string | null;
  consultation_stage?: string | null;
  selected_doctor_id?: string | null;
  patient_availability?: unknown | null;
  scheduled_at?: string | null;
  meeting_link?: string | null;
  payment_status?: string | null;
  payment_amount?: number | string | null;
  payment_currency?: string | null;
  payment_reference?: string | null;
  payment_confirmed_at?: string | null;
  payment_link?: string | null;
  payment_proof_storage_path?: string | null;
  payment_proof_file_name?: string | null;
  payment_proof_mime_type?: string | null;
  payment_proof_submitted_at?: string | null;
  pse_scheduling_message?: string | null;
  schedule_confirmed_at?: string | null;
  consultation_duration_minutes?: number | null;
  consultation_fee_usd?: number | null;
  consultation_currency?: string | null;
  invoice_pdf_storage_path?: string | null;
  invoice_generated_at?: string | null;
  invoice_number?: string | null;
  invoice_subtotal?: number | string | null;
  invoice_tax_rate?: number | string | null;
  invoice_tax_amount?: number | string | null;
  invoice_total?: number | string | null;
  records_verified_at?: string | null;
  case_details_reviewed_at?: string | null;
  records_rejected_at?: string | null;
  records_rejection_reason?: string | null;
  patient_proceeded_without_records_at?: string | null;
  pse_proceeded_without_records_at?: string | null;
  patient_case_details?: unknown | null;
  doctor_response: string | null;
  responded_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  coordination_notes: string | null;
  assignee: { full_name: string } | null;
  doctors: { id: string; full_name: string; specialty: string } | null;
  opinion_request_records: Array<{
    uploaded_files: OpinionRequestFile | null;
    medical_records?: OpinionRequestFile | null;
  }> | null;
};

export type CreateOpinionRequestInput = {
  doctorId: string;
  message: string;
  recordIds: string[];
  patientId: string | null;
  patientName?: string | null;
  doctorName?: string | null;
  consultationDurationMinutes?: number;
  caseDetails?: Record<string, unknown> | null;
};

export type CreateRecommendationOpinionRequestInput = {
  message: string;
  recordIds: string[];
  patientId: string | null;
  patientName?: string | null;
  requestedSpecialty: string;
  consultationDurationMinutes?: number;
  caseDetails?: Record<string, unknown> | null;
};

type ResolveDoctorRecommendationHint = Pick<
  OpinionRequestRecommendation,
  'doctor_id' | 'doctor_name' | 'doctor_consultation_tiers' | 'doctor_consultation_currency'
>;

type ResolveDoctorContext = {
  requestId?: string;
  recommendation?: ResolveDoctorRecommendationHint;
};

function doctorFromRecommendationHint(hint: ResolveDoctorRecommendationHint): Doctor {
  return normalizeDoctor({
    id: hint.doctor_id,
    full_name: hint.doctor_name?.trim() || 'Doctor',
    specialty: '',
    consultation_tiers: hint.doctor_consultation_tiers ?? null,
    consultation_currency: hint.doctor_consultation_currency ?? 'USD',
    consultation_fee: 0,
    fee_usd: 0
  } as Doctor);
}

async function verifyDoctorRecommendedForPatientRequest(requestId: string, doctorId: string) {
  const { data, error } = await supabase
    .from('opinion_request_recommendations')
    .select('doctor_id')
    .eq('request_id', requestId)
    .eq('doctor_id', doctorId)
    .maybeSingle();

  return !error && Boolean(data);
}

/** Resolve doctors.id — never persist auth.users id in opinion_requests.doctor_id */
async function resolveDoctorRecord(doctorId: string, context?: ResolveDoctorContext) {
  const trimmedId = doctorId.trim();
  if (!trimmedId) {
    return {
      doctor: null,
      error: { message: 'Doctor not found. doctor_id must match public.doctors.id.' }
    };
  }

  const byId = await fetchDoctorById(trimmedId);
  if (byId.data) return { doctor: byId.data, error: null };

  const byAuth = await fetchDoctorByAuthUserId(trimmedId);
  if (byAuth.data) return { doctor: byAuth.data, error: null };

  if (context?.recommendation?.doctor_id === trimmedId) {
    return { doctor: doctorFromRecommendationHint(context.recommendation), error: null };
  }

  if (context?.requestId) {
    const recommended = await verifyDoctorRecommendedForPatientRequest(context.requestId, trimmedId);
    if (recommended) {
      const retry = await fetchDoctorById(trimmedId);
      if (retry.data) return { doctor: retry.data, error: null };

      if (context.recommendation?.doctor_id === trimmedId) {
        return { doctor: doctorFromRecommendationHint(context.recommendation), error: null };
      }

      return {
        doctor: doctorFromRecommendationHint({
          doctor_id: trimmedId,
          doctor_name: null,
          doctor_consultation_tiers: null,
          doctor_consultation_currency: null
        }),
        error: null
      };
    }
  }

  return {
    doctor: null,
    error: { message: 'Doctor not found. doctor_id must match public.doctors.id.' }
  };
}

async function resolveNames(
  input: CreateOpinionRequestInput,
  doctor: { id: string; full_name: string }
) {
  let patientName = input.patientName?.trim() || null;
  let doctorName = input.doctorName?.trim() || doctor.full_name;

  if (!patientName && input.patientId) {
    const { data: patient } = await fetchPatientByAuthUserId(input.patientId);
    patientName = patient?.full_name ?? null;
  }

  return { patientName, doctorName };
}

export async function createOpinionRequest(input: CreateOpinionRequestInput) {
  const { doctor, error: doctorError } = await resolveDoctorRecord(input.doctorId);
  if (doctorError || !doctor) {
    return { data: null, error: doctorError ?? { message: 'Doctor not found.' } };
  }

  const { patientName, doctorName } = await resolveNames(input, doctor);
  const durationMinutes = input.consultationDurationMinutes ?? null;
  const consultationFeeUsd =
    durationMinutes != null ? getTierFeeUsd(doctor, durationMinutes) : null;

  const pricingFields =
    durationMinutes != null
      ? {
          consultation_duration_minutes: durationMinutes,
          consultation_fee_usd: consultationFeeUsd,
          consultation_currency: doctorConsultationCurrency(doctor)
        }
      : {};

  const baseInsert = {
    doctor_id: doctor.id,
    doctor_name: doctorName,
    message: input.message.trim(),
    patient_id: input.patientId,
    patient_name: patientName,
    status: 'submitted' as const,
    doctor_selection_mode: 'self_select' as const,
    patient_case_details: input.caseDetails ?? null,
    ...pricingFields
  };

  let requestError = null;
  let request: { id: string } | null = null;

  const withWorkflow = await supabase
    .from('opinion_requests')
    .insert({
      ...baseInsert,
      consultation_stage: 'new',
      selected_doctor_id: doctor.id
    })
    .select('id')
    .single();

  if (!withWorkflow.error && withWorkflow.data) {
    request = withWorkflow.data;
  } else if (isMissingDoctorSelectionModeError(withWorkflow.error)) {
    const withoutMode = await supabase
      .from('opinion_requests')
      .insert({
        doctor_id: doctor.id,
        doctor_name: doctorName,
        message: input.message.trim(),
        patient_id: input.patientId,
        patient_name: patientName,
        status: 'submitted',
        consultation_stage: 'new',
        selected_doctor_id: doctor.id
      })
      .select('id')
      .single();
    requestError = withoutMode.error;
    request = withoutMode.data;
  } else if (isMissingWorkflowColumnsError(withWorkflow.error)) {
    const legacy = await supabase.from('opinion_requests').insert({
      doctor_id: doctor.id,
      doctor_name: doctorName,
      message: input.message.trim(),
      patient_id: input.patientId,
      patient_name: patientName,
      status: 'submitted'
    }).select('id').single();
    requestError = legacy.error;
    request = legacy.data;
  } else {
    requestError = withWorkflow.error;
  }

  if (requestError || !request) {
    return { data: null, error: requestError };
  }

  if (input.recordIds.length > 0) {
    const links = input.recordIds.map((recordId) => ({
      request_id: request.id,
      record_id: recordId
    }));

    const { error: linkError } = await supabase.from('opinion_request_records').insert(links);

    if (linkError) {
      const hint =
        linkError.message?.includes('foreign key') || linkError.message?.includes('record_id')
          ? ' Run supabase/migrations/020_opinion_request_files_access.sql in the Supabase SQL Editor.'
          : '';
      return { data: null, error: { message: `${linkError.message}${hint}` } };
    }
  }

  await logRequestAudit(request.id, 'request_created', 'patient', {
    metadata: { doctor_id: doctor.id, doctor_name: doctorName }
  });
  return { data: { id: request.id }, error: null };
}

export type CreateClinicPseOpinionRequestInput = {
  patientProfileId: string;
  doctorId: string;
  message: string;
  consultationDurationMinutes?: number | null;
  staffId: string;
  clinicId: string;
};

/** Clinic PSE creates a patient → doctor request in their clinic workspace (auto-assigned to staff). */
export async function createClinicPseOpinionRequest(input: CreateClinicPseOpinionRequestInput) {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id, auth_user_id, full_name, clinic_id, email')
    .eq('id', input.patientProfileId)
    .maybeSingle();

  if (patientError) {
    return { data: null, error: patientError };
  }
  if (!patient) {
    return { data: null, error: { message: 'Patient not found.' } };
  }
  if (patient.clinic_id !== input.clinicId) {
    return { data: null, error: { message: 'Patient is not in your clinic workspace.' } };
  }

  const { doctor, error: doctorError } = await resolveDoctorRecord(input.doctorId);
  if (doctorError || !doctor) {
    return { data: null, error: doctorError ?? { message: 'Doctor not found.' } };
  }

  const { available, error: availabilityError } = await isDoctorAvailableToClinic(
    doctor.id,
    input.clinicId
  );
  if (availabilityError) {
    return { data: null, error: availabilityError };
  }
  if (!available) {
    return { data: null, error: { message: 'Doctor is not in your clinic workspace.' } };
  }

  const message = input.message.trim() || 'Consultation request';
  const durationMinutes = input.consultationDurationMinutes ?? null;
  const consultationFeeUsd =
    durationMinutes != null ? getTierFeeUsd(doctor, durationMinutes) : null;

  const pricingFields =
    durationMinutes != null
      ? {
          consultation_duration_minutes: durationMinutes,
          consultation_fee_usd: consultationFeeUsd,
          consultation_currency: doctorConsultationCurrency(doctor)
        }
      : {};

  const assignedAt = new Date().toISOString();

  const baseInsert = {
    doctor_id: doctor.id,
    doctor_name: doctor.full_name,
    message,
    patient_id: patient.auth_user_id,
    patient_name: patient.full_name,
    status: 'submitted' as const,
    doctor_selection_mode: 'self_select' as const,
    selected_doctor_id: doctor.id,
    clinic_id: input.clinicId,
    assigned_to: input.staffId,
    assigned_at: assignedAt,
    consultation_stage: 'assigned' as const,
    ...pricingFields
  };

  let requestError = null;
  let request: { id: string } | null = null;

  const withWorkflow = await supabase
    .from('opinion_requests')
    .insert(baseInsert)
    .select('id')
    .single();

  if (!withWorkflow.error && withWorkflow.data) {
    request = withWorkflow.data;
  } else if (isMissingDoctorSelectionModeError(withWorkflow.error)) {
    const { doctor_selection_mode: _mode, ...withoutMode } = baseInsert;
    const fallback = await supabase.from('opinion_requests').insert(withoutMode).select('id').single();
    requestError = fallback.error;
    request = fallback.data;
  } else if (isMissingWorkflowColumnsError(withWorkflow.error)) {
    const legacy = await supabase
      .from('opinion_requests')
      .insert({
        doctor_id: doctor.id,
        doctor_name: doctor.full_name,
        message,
        patient_id: patient.auth_user_id,
        patient_name: patient.full_name,
        status: 'submitted',
        clinic_id: input.clinicId,
        assigned_to: input.staffId,
        assigned_at: assignedAt
      })
      .select('id')
      .single();
    requestError = legacy.error;
    request = legacy.data;
  } else {
    requestError = withWorkflow.error;
  }

  if (requestError || !request) {
    const hint =
      requestError?.code === '42501' || requestError?.message?.toLowerCase().includes('permission')
        ? ' Run npm run db:apply-clinic-pse if clinic workspace migration is missing.'
        : '';
    return { data: null, error: { message: `${requestError?.message ?? 'Could not create request.'}${hint}` } };
  }

  await logRequestAudit(request.id, 'request_created', 'pse', {
    metadata: {
      doctor_id: doctor.id,
      doctor_name: doctor.full_name,
      patient_profile_id: patient.id,
      clinic_created: true
    }
  });

  return { data: { id: request.id }, error: null };
}

async function resolvePatientName(patientId: string | null, patientName?: string | null) {
  let resolved = patientName?.trim() || null;
  if (!resolved && patientId) {
    const { data: patient } = await fetchPatientByAuthUserId(patientId);
    resolved = patient?.full_name ?? null;
  }
  return resolved;
}

export async function createRecommendationOpinionRequest(input: CreateRecommendationOpinionRequestInput) {
  const patientName = await resolvePatientName(input.patientId, input.patientName);
  const requestedSpecialty = input.requestedSpecialty.trim();

  if (!requestedSpecialty) {
    return { data: null, error: { message: 'Select a specialty for your recommendation request.' } };
  }

  const durationMinutes = input.consultationDurationMinutes ?? null;
  const pricingFields =
    durationMinutes != null ? { consultation_duration_minutes: durationMinutes } : {};

  const baseInsert = {
    doctor_id: null,
    doctor_name: null,
    message: input.message.trim(),
    patient_id: input.patientId,
    patient_name: patientName,
    status: 'submitted' as const,
    doctor_selection_mode: 'needs_recommendation' as const,
    requested_specialty: requestedSpecialty,
    patient_case_details: input.caseDetails ?? null,
    ...pricingFields
  };

  let requestError = null;
  let request: { id: string } | null = null;

  const withWorkflow = await supabase
    .from('opinion_requests')
    .insert({
      ...baseInsert,
      consultation_stage: 'new',
      selected_doctor_id: null
    })
    .select('id')
    .single();

  if (!withWorkflow.error && withWorkflow.data) {
    request = withWorkflow.data;
  } else if (isNullableDoctorIdBlocked(withWorkflow.error) || isMissingDoctorSelectionModeError(withWorkflow.error)) {
    return {
      data: null,
      error: {
        message: `Recommendation requests need database migration 029 (nullable doctor_id). ${recommendationMigrationHint()}`
      }
    };
  } else if (isMissingWorkflowColumnsError(withWorkflow.error)) {
    return {
      data: null,
      error: {
        message: `Recommendation requests need the consultation workflow columns (migration 019). ${recommendationMigrationHint()}`
      }
    };
  } else if (isMissingRequestedSpecialtyError(withWorkflow.error)) {
    const withoutSpecialty = await supabase
      .from('opinion_requests')
      .insert({
        doctor_id: null,
        doctor_name: null,
        message: input.message.trim(),
        patient_id: input.patientId,
        patient_name: patientName,
        status: 'submitted',
        doctor_selection_mode: 'needs_recommendation',
        consultation_stage: 'new',
        selected_doctor_id: null
      })
      .select('id')
      .single();
    requestError = withoutSpecialty.error;
    request = withoutSpecialty.data;
  } else {
    requestError = withWorkflow.error;
  }

  if (requestError || !request) {
    const baseMessage = requestError?.message ?? 'Could not create recommendation request.';
    return {
      data: null,
      error: { message: `${baseMessage} ${recommendationMigrationHint()}` }
    };
  }

  if (input.recordIds.length > 0) {
    const links = input.recordIds.map((recordId) => ({
      request_id: request.id,
      record_id: recordId
    }));

    const { error: linkError } = await supabase.from('opinion_request_records').insert(links);

    if (linkError) {
      const hint =
        linkError.message?.includes('foreign key') || linkError.message?.includes('record_id')
          ? ' Run supabase/migrations/020_opinion_request_files_access.sql in the Supabase SQL Editor.'
          : '';
      return { data: null, error: { message: `${linkError.message}${hint}` } };
    }
  }

  await logRequestAudit(request.id, 'recommendation_request_created', 'patient', {
    metadata: {
      requested_specialty: input.requestedSpecialty?.trim() || null,
      record_count: input.recordIds.length
    }
  });
  return { data: { id: request.id }, error: null };
}

export function isRecommendationOpinionRequest(
  request: Pick<OpinionRequest, 'doctor_selection_mode' | 'doctor_id'>
): boolean {
  return request.doctor_selection_mode === 'needs_recommendation' || (!request.doctor_id && !request.doctor_selection_mode);
}

function mapRequestRow(
  row: RequestListRow,
  patientMap: Map<string, { full_name: string; email: string }>
): OpinionRequest {
  const patient = row.patient_id ? patientMap.get(row.patient_id) : undefined;
  const records: OpinionRequestFile[] = [];

  for (const link of row.opinion_request_records ?? []) {
    const file = link.uploaded_files ?? link.medical_records ?? null;
    if (file?.id) records.push(file);
  }

  return {
    id: row.id,
    message: row.message,
    status: row.status as OpinionRequestStatus,
    created_at: row.created_at,
    patient_id: row.patient_id,
    patient_name: row.patient_name ?? patient?.full_name ?? null,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name ?? row.doctors?.full_name ?? null,
    doctor_specialty: row.doctors?.specialty ?? null,
    doctor_selection_mode: row.doctor_selection_mode ?? (row.doctor_id ? 'self_select' : 'needs_recommendation'),
    requested_specialty: row.requested_specialty ?? null,
    patient_email: patient?.email ?? null,
    doctor_response: row.doctor_response,
    responded_at: row.responded_at,
    assigned_to: row.assigned_to ?? null,
    assigned_at: row.assigned_at ?? null,
    assigned_to_name: row.assignee?.full_name ?? null,
    coordination_notes: row.coordination_notes ?? null,
    consultation_stage: (row.consultation_stage as ConsultationStage | undefined) ?? null,
    selected_doctor_id: row.selected_doctor_id ?? null,
    patient_availability: row.patient_availability ?? null,
    scheduled_at: row.scheduled_at ?? null,
    meeting_link: row.meeting_link ?? null,
    payment_status: (row.payment_status as PaymentStatus | undefined) ?? null,
    payment_amount:
      row.payment_amount === null || row.payment_amount === undefined
        ? null
        : typeof row.payment_amount === 'string'
          ? Number(row.payment_amount)
          : Number(row.payment_amount),
    payment_currency: row.payment_currency ?? null,
    payment_reference: row.payment_reference ?? null,
    payment_confirmed_at: row.payment_confirmed_at ?? null,
    payment_link: row.payment_link ?? null,
    payment_proof_storage_path: row.payment_proof_storage_path ?? null,
    payment_proof_file_name: row.payment_proof_file_name ?? null,
    payment_proof_mime_type: row.payment_proof_mime_type ?? null,
    payment_proof_submitted_at: row.payment_proof_submitted_at ?? null,
    pse_scheduling_message: row.pse_scheduling_message ?? null,
    schedule_confirmed_at: row.schedule_confirmed_at ?? null,
    consultation_duration_minutes:
      row.consultation_duration_minutes == null
        ? null
        : Number(row.consultation_duration_minutes),
    consultation_fee_usd:
      row.consultation_fee_usd === null || row.consultation_fee_usd === undefined
        ? null
        : Number(row.consultation_fee_usd),
    consultation_currency: row.consultation_currency ?? null,
    invoice_pdf_storage_path: row.invoice_pdf_storage_path ?? null,
    invoice_generated_at: row.invoice_generated_at ?? null,
    invoice_number: row.invoice_number ?? null,
    invoice_subtotal:
      row.invoice_subtotal == null ? null : Number(row.invoice_subtotal),
    invoice_tax_rate: row.invoice_tax_rate == null ? null : Number(row.invoice_tax_rate),
    invoice_tax_amount:
      row.invoice_tax_amount == null ? null : Number(row.invoice_tax_amount),
    invoice_total: row.invoice_total == null ? null : Number(row.invoice_total),
    records_verified_at: row.records_verified_at ?? null,
    case_details_reviewed_at: row.case_details_reviewed_at ?? null,
    records_rejected_at: row.records_rejected_at ?? null,
    records_rejection_reason: row.records_rejection_reason ?? null,
    patient_proceeded_without_records_at: row.patient_proceeded_without_records_at ?? null,
    pse_proceeded_without_records_at: row.pse_proceeded_without_records_at ?? null,
    patient_case_details: row.patient_case_details ?? null,
    records
  };
}

export async function submitDoctorOpinionResponse(requestId: string, responseText: string) {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return { data: null, error: { message: 'Write your response before sending.' } };
  }

  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      doctor_response: trimmed,
      responded_at: new Date().toISOString(),
      status: 'closed'
    })
    .eq('id', requestId)
    .select('id, status, doctor_response, responded_at')
    .single();

  if (error) {
    const hint = isMissingResponseColumnsError(error)
      ? ' Run supabase/migrations/009_opinion_doctor_response.sql in the Supabase SQL Editor.'
      : '';
    return { data: null, error: { message: `${error.message}${hint}` } };
  }
  await logRequestAudit(requestId, 'doctor_opinion_submitted', 'doctor');
  return { data, error: null };
}

async function loadPatientEmailMap(authUserIds: string[]) {
  const patientMap = new Map<string, { full_name: string; email: string }>();
  if (!authUserIds.length) return patientMap;

  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('auth_user_id, full_name, email')
    .in('auth_user_id', authUserIds);

  if (patientsError) throw patientsError;

  for (const p of patients ?? []) {
    if (p.auth_user_id) {
      patientMap.set(p.auth_user_id, { full_name: p.full_name, email: p.email });
    }
  }
  return patientMap;
}

type FetchOpinionRequestsResult = {
  data: OpinionRequest[] | null;
  error: { message: string } | null;
  /** False until migration 009_opinion_doctor_response.sql is applied */
  responsesEnabled: boolean;
};

type WorkflowFieldRow = Pick<
  RequestListRow,
  | 'id'
  | 'consultation_stage'
  | 'selected_doctor_id'
  | 'patient_availability'
  | 'scheduled_at'
  | 'meeting_link'
  | 'payment_status'
  | 'payment_amount'
  | 'payment_currency'
  | 'payment_reference'
  | 'payment_confirmed_at'
  | 'payment_link'
  | 'payment_proof_storage_path'
  | 'payment_proof_file_name'
  | 'payment_proof_mime_type'
  | 'payment_proof_submitted_at'
  | 'pse_scheduling_message'
  | 'schedule_confirmed_at'
  | 'records_verified_at'
  | 'case_details_reviewed_at'
  | 'records_rejected_at'
  | 'records_rejection_reason'
  | 'patient_proceeded_without_records_at'
  | 'pse_proceeded_without_records_at'
  | 'patient_case_details'
  | 'invoice_pdf_storage_path'
  | 'invoice_generated_at'
  | 'invoice_number'
  | 'invoice_subtotal'
  | 'invoice_tax_rate'
  | 'invoice_tax_amount'
  | 'invoice_total'
>;

function mergeWorkflowFields(request: OpinionRequest, row: WorkflowFieldRow): OpinionRequest {
  return {
    ...request,
    consultation_stage: (row.consultation_stage as ConsultationStage | undefined) ?? request.consultation_stage,
    selected_doctor_id: row.selected_doctor_id ?? request.selected_doctor_id,
    patient_availability: row.patient_availability ?? request.patient_availability,
    scheduled_at: row.scheduled_at ?? request.scheduled_at,
    meeting_link: row.meeting_link ?? request.meeting_link,
    payment_status: (row.payment_status as PaymentStatus | undefined) ?? request.payment_status,
    payment_amount:
      row.payment_amount === null || row.payment_amount === undefined
        ? request.payment_amount
        : typeof row.payment_amount === 'string'
          ? Number(row.payment_amount)
          : Number(row.payment_amount),
    payment_currency: row.payment_currency ?? request.payment_currency,
    payment_reference: row.payment_reference ?? request.payment_reference,
    payment_confirmed_at: row.payment_confirmed_at ?? request.payment_confirmed_at,
    payment_link: row.payment_link ?? request.payment_link,
    payment_proof_storage_path:
      row.payment_proof_storage_path ?? request.payment_proof_storage_path,
    payment_proof_file_name: row.payment_proof_file_name ?? request.payment_proof_file_name,
    payment_proof_mime_type: row.payment_proof_mime_type ?? request.payment_proof_mime_type,
    payment_proof_submitted_at:
      row.payment_proof_submitted_at ?? request.payment_proof_submitted_at,
    pse_scheduling_message: row.pse_scheduling_message ?? request.pse_scheduling_message,
    schedule_confirmed_at: row.schedule_confirmed_at ?? request.schedule_confirmed_at,
    consultation_duration_minutes:
      row.consultation_duration_minutes == null
        ? request.consultation_duration_minutes
        : Number(row.consultation_duration_minutes),
    consultation_fee_usd:
      row.consultation_fee_usd == null
        ? request.consultation_fee_usd
        : Number(row.consultation_fee_usd),
    consultation_currency: row.consultation_currency ?? request.consultation_currency,
    invoice_pdf_storage_path: row.invoice_pdf_storage_path ?? request.invoice_pdf_storage_path,
    invoice_generated_at: row.invoice_generated_at ?? request.invoice_generated_at,
    invoice_number: row.invoice_number ?? request.invoice_number,
    invoice_subtotal:
      row.invoice_subtotal == null ? request.invoice_subtotal : Number(row.invoice_subtotal),
    invoice_tax_rate:
      row.invoice_tax_rate == null ? request.invoice_tax_rate : Number(row.invoice_tax_rate),
    invoice_tax_amount:
      row.invoice_tax_amount == null ? request.invoice_tax_amount : Number(row.invoice_tax_amount),
    invoice_total: row.invoice_total == null ? request.invoice_total : Number(row.invoice_total),
    records_verified_at: row.records_verified_at ?? request.records_verified_at,
    case_details_reviewed_at: row.case_details_reviewed_at ?? request.case_details_reviewed_at,
    records_rejected_at: row.records_rejected_at ?? request.records_rejected_at,
    records_rejection_reason: row.records_rejection_reason ?? request.records_rejection_reason,
    patient_proceeded_without_records_at:
      row.patient_proceeded_without_records_at ?? request.patient_proceeded_without_records_at,
    pse_proceeded_without_records_at:
      row.pse_proceeded_without_records_at ?? request.pse_proceeded_without_records_at,
    patient_case_details:
      row.patient_case_details !== undefined && row.patient_case_details !== null
        ? row.patient_case_details
        : request.patient_case_details
  };
}

/** Second query so workflow fields load even when list select falls back without them. */
async function enrichRequestsWithWorkflowFields(requests: OpinionRequest[]): Promise<OpinionRequest[]> {
  if (!requests.length) return requests;

  const ids = requests.map((request) => request.id);
  const selectAttempts = [
    `id, ${workflowFields}`,
    `id, ${workflowFieldsCore}, records_verified_at, ${workflowFieldsScheduling}`,
    `id, ${workflowFieldsCore}, ${workflowFieldsScheduling}`,
    `id, ${workflowFieldsCore}, records_verified_at`,
    `id, ${workflowFieldsCore}`,
    'id, consultation_stage, selected_doctor_id, patient_availability, doctor_id, doctor_name'
  ];

  let data: WorkflowFieldRow[] | null = null;
  for (const workflowSelect of selectAttempts) {
    const result = await supabase.from('opinion_requests').select(workflowSelect).in('id', ids);
    if (!result.error && result.data?.length) {
      data = result.data as WorkflowFieldRow[];
      break;
    }
    if (result.error && isMissingWorkflowColumnsError(result.error)) {
      const withoutInvoice = stripInvoiceFromSelect(workflowSelect);
      if (withoutInvoice !== workflowSelect) {
        const retryInvoice = await supabase.from('opinion_requests').select(withoutInvoice).in('id', ids);
        if (!retryInvoice.error && retryInvoice.data?.length) {
          data = retryInvoice.data as WorkflowFieldRow[];
          break;
        }
      }
      const withoutProof = stripPaymentProofFromSelect(workflowSelect);
      if (withoutProof !== workflowSelect) {
        const retryProof = await supabase.from('opinion_requests').select(withoutProof).in('id', ids);
        if (!retryProof.error && retryProof.data?.length) {
          data = retryProof.data as WorkflowFieldRow[];
          break;
        }
      }
      const withoutScheduling = stripSchedulingFromSelect(stripPaymentProofFromSelect(workflowSelect));
      if (withoutScheduling !== workflowSelect) {
        const retryScheduling = await supabase
          .from('opinion_requests')
          .select(withoutScheduling)
          .in('id', ids);
        if (!retryScheduling.error && retryScheduling.data?.length) {
          data = retryScheduling.data as WorkflowFieldRow[];
          break;
        }
      }
    }
  }

  if (!data?.length) return enrichRequestsWithPaymentLink(requests);

  const byId = new Map(data.map((row) => [row.id, row]));
  const merged = requests.map((request) => {
    const workflow = byId.get(request.id);
    return workflow ? mergeWorkflowFields(request, workflow) : request;
  });
  return enrichRequestsWithPaymentLink(merged);
}

type PaymentLinkRow = Pick<
  OpinionRequest,
  'id' | 'payment_link' | 'payment_amount' | 'payment_currency' | 'payment_status' | 'consultation_stage'
>;

/** Loads payment link fields when the main workflow select omitted them (e.g. missing payment_proof columns). */
async function enrichRequestsWithPaymentLink(requests: OpinionRequest[]): Promise<OpinionRequest[]> {
  const needsLink = requests.filter(
    (request) =>
      !request.payment_link?.trim() &&
      (request.payment_status === 'pending' ||
        request.consultation_stage === 'payment_pending' ||
        request.consultation_stage === 'schedule_confirmed')
  );
  if (!needsLink.length) return requests;

  const ids = needsLink.map((request) => request.id);
  const selectAttempts = [
    'id, payment_link, payment_amount, payment_currency, payment_status, consultation_stage',
    'id, payment_link, payment_amount, payment_currency, payment_status',
    'id, payment_link'
  ];

  let rows: PaymentLinkRow[] | null = null;
  for (const paymentSelect of selectAttempts) {
    const result = await supabase.from('opinion_requests').select(paymentSelect).in('id', ids);
    if (!result.error && result.data?.length) {
      rows = result.data as PaymentLinkRow[];
      break;
    }
  }

  if (!rows?.length) return requests;

  const byId = new Map(rows.map((row) => [row.id, row]));
  return requests.map((request) => {
    const row = byId.get(request.id);
    if (!row?.payment_link?.trim()) return request;
    return {
      ...request,
      payment_link: row.payment_link,
      payment_amount: row.payment_amount ?? request.payment_amount,
      payment_currency: row.payment_currency ?? request.payment_currency,
      payment_status: row.payment_status ?? request.payment_status,
      consultation_stage: row.consultation_stage ?? request.consultation_stage
    };
  });
}

/** Resolve PSE names when the assignee embed is omitted (RLS / select fallback). */
async function enrichRequestsWithAssigneeNames(
  requests: OpinionRequest[]
): Promise<OpinionRequest[]> {
  const missingIds = [
    ...new Set(
      requests
        .filter((request) => request.assigned_to && !request.assigned_to_name?.trim())
        .map((request) => request.assigned_to as string)
    )
  ];

  if (!missingIds.length) return requests;

  const { data, error } = await supabase.from('admins').select('id, full_name').in('id', missingIds);

  if (error || !data?.length) return requests;

  const nameById = new Map(data.map((row) => [row.id, row.full_name as string]));

  return requests.map((request) => {
    if (!request.assigned_to || request.assigned_to_name?.trim()) return request;
    const name = nameById.get(request.assigned_to);
    return name ? { ...request, assigned_to_name: name } : request;
  });
}

async function fetchPatientOpinionRequestRows(
  patientAuthUserId: string
): Promise<{ rows: RequestListRow[] | null; error: { message: string; code?: string } | null; responsesEnabled: boolean }> {
  const buildQuery = (select: string) =>
    supabase
      .from('opinion_requests')
      .select(select)
      .eq('patient_id', patientAuthUserId)
      .order('created_at', { ascending: false })
      .returns<RequestListRow[]>();

  let result = await buildQuery(requestListSelectPatient);
  if (!result.error) {
    return { rows: result.data, error: null, responsesEnabled: true };
  }

  let lastError = result.error;

  if (isMissingDoctorSelectionModeError(lastError)) {
    result = await buildQuery(stripDoctorSelectionModeFromSelect(requestListSelectPatient));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingRequestedSpecialtyError(lastError)) {
    result = await buildQuery(stripRequestedSpecialtyFromSelect(requestListSelectPatient));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingRecordsVerifiedColumnError(lastError)) {
    result = await buildQuery(stripRecordsVerifiedFromSelect(requestListSelectPatient));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingPatientCaseDetailsColumnError(lastError)) {
    result = await buildQuery(stripPatientCaseDetailsFromSelect(requestListSelectPatient));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingProceedWithoutRecordsColumnError(lastError)) {
    result = await buildQuery(stripProceededWithoutRecordsFromSelect(requestListSelectPatient));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingWorkflowColumnsError(lastError)) {
    result = await buildQuery(
      `
      id,
      message,
      status,
      created_at,
      patient_id,
      patient_name,
      doctor_id,
      doctor_name,
      doctor_response,
      responded_at,
      assigned_to,
      assigned_at,
      coordination_notes,
      doctors (id, full_name, specialty)
    `
    );
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  return fetchOpinionRequestRows({ column: 'patient_id', value: patientAuthUserId });
}

async function fetchOpinionRequestRows(
  filter?: { column: 'patient_id' | 'doctor_id'; value: string }
): Promise<{ rows: RequestListRow[] | null; error: { message: string; code?: string } | null; responsesEnabled: boolean }> {
  const buildQuery = (select: string) => {
    let q = supabase.from('opinion_requests').select(select).order('created_at', { ascending: false });
    if (filter) q = q.eq(filter.column, filter.value);
    return q.returns<RequestListRow[]>();
  };

  let result = await buildQuery(requestListSelectWithResponse);
  if (!result.error) {
    return { rows: result.data, error: null, responsesEnabled: true };
  }

  let lastError = result.error;

  if (isMissingDoctorSelectionModeError(lastError)) {
    result = await buildQuery(stripDoctorSelectionModeFromSelect(requestListSelectWithResponse));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingRequestedSpecialtyError(lastError)) {
    result = await buildQuery(stripRequestedSpecialtyFromSelect(requestListSelectWithResponse));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingRecordsVerifiedColumnError(lastError)) {
    result = await buildQuery(stripRecordsVerifiedFromSelect(requestListSelectWithResponse));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingPatientCaseDetailsColumnError(lastError)) {
    result = await buildQuery(stripPatientCaseDetailsFromSelect(requestListSelectWithResponse));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingProceedWithoutRecordsColumnError(lastError)) {
    result = await buildQuery(stripProceededWithoutRecordsFromSelect(requestListSelectWithResponse));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingWorkflowColumnsError(lastError)) {
    result = await buildQuery(stripExtendedWorkflowFromSelect(requestListSelectWithResponse));
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;

    result = await buildQuery(
      stripRecordsVerifiedFromSelect(stripExtendedWorkflowFromSelect(requestListSelectWithResponse))
    );
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingWorkflowColumnsError(lastError)) {
    result = await buildQuery(requestListSelectWithResponseLegacy);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingAssignmentColumnsError(lastError)) {
    result = await buildQuery(requestListSelectWithResponseNoAssignLegacy);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;

    result = await buildQuery(requestListSelectWithResponseNoAssign);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: true };
    }
    lastError = result.error;
  }

  if (isMissingResponseColumnsError(lastError)) {
    result = await buildQuery(requestListSelectBaseLegacy);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: false };
    }
    lastError = result.error;

    result = await buildQuery(requestListSelectBase);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: false };
    }
    lastError = result.error;
  }

  result = await buildQuery(requestListSelectMinimalLegacy);
  if (!result.error) {
    return { rows: result.data, error: null, responsesEnabled: true };
  }
  lastError = result.error;

  if (isMissingResponseColumnsError(lastError)) {
    result = await buildQuery(requestListSelectMinimalBase);
    if (!result.error) {
      return { rows: result.data, error: null, responsesEnabled: false };
    }
    lastError = result.error;
  }

  return {
    rows: null,
    error: lastError ? { message: lastError.message, code: lastError.code } : { message: 'Unknown error' },
    responsesEnabled: false
  };
}

function permissionHint(code?: string, message?: string) {
  if (code === '42501' || message?.toLowerCase().includes('permission')) {
    return ' Run supabase/migrations/006_doctor_opinion_access.sql in the Supabase SQL Editor.';
  }
  return '';
}

/** Loads request↔file links in a second query so RLS/embed issues do not hide attachments. */
async function attachRequestRecords(requests: OpinionRequest[]): Promise<OpinionRequest[]> {
  if (!requests.length) return requests;

  const requestIds = requests.map((request) => request.id);
  const { data: links, error: linksError } = await supabase
    .from('opinion_request_records')
    .select('request_id, record_id')
    .in('request_id', requestIds);

  if (linksError || !links?.length) {
    return requests;
  }

  const recordIds = [...new Set(links.map((link) => link.record_id))];
  const { data: files, error: filesError } = await supabase
    .from('uploaded_files')
    .select('id, file_name, summary, storage_path')
    .in('id', recordIds);

  if (filesError || !files?.length) {
    return requests;
  }

  const fileMap = new Map<string, OpinionRequestFile>();
  for (const file of files) {
    if (file.id) fileMap.set(file.id, file);
  }

  const recordsByRequest = new Map<string, OpinionRequestFile[]>();
  for (const link of links) {
    const file = fileMap.get(link.record_id);
    if (!file) continue;
    const list = recordsByRequest.get(link.request_id) ?? [];
    list.push(file);
    recordsByRequest.set(link.request_id, list);
  }

  return requests.map((request) => {
    const attached = recordsByRequest.get(request.id);
    if (!attached?.length) return request;
    return {
      ...request,
      records: attached.length >= request.records.length ? attached : request.records
    };
  });
}

async function enrichRequestsWithConsultationSummaries(
  requests: OpinionRequest[]
): Promise<OpinionRequest[]> {
  if (!requests.length) return requests;

  const requestIds = requests.map((request) => request.id);
  const { data, error } = await supabase
    .from('consultation_summaries')
    .select(CONSULTATION_SUMMARY_SELECT)
    .in('request_id', requestIds)
    .returns<ConsultationSummary[]>();

  if (error || !data?.length) return requests;

  const summaryByRequestId = new Map(data.map((summary) => [summary.request_id, summary]));

  return requests.map((request) => {
    const summary = summaryByRequestId.get(request.id);
    if (!summary) return request;
    return { ...request, consultation_summary: summary };
  });
}

export async function fetchPatientOpinionRequests(patientAuthUserId: string): Promise<FetchOpinionRequestsResult> {
  let { rows, error, responsesEnabled } = await fetchPatientOpinionRequestRows(patientAuthUserId);

  if (!error && (rows?.length ?? 0) === 0) {
    const broad = await fetchOpinionRequestRows();
    if (!broad.error && (broad.rows?.length ?? 0) > 0) {
      rows = (broad.rows ?? []).filter((row) => row.patient_id === patientAuthUserId);
      responsesEnabled = broad.responsesEnabled;
    }
  }

  if (error) {
    return {
      data: null,
      error: { message: `${error.message}${permissionHint(error.code, error.message)}` },
      responsesEnabled: false
    };
  }

  const mapped = (rows ?? []).map((row) => mapRequestRow(row, new Map()));
  const withWorkflow = await enrichRequestsWithWorkflowFields(mapped);
  const data = await attachRequestRecords(withWorkflow);
  return {
    data,
    error: null,
    responsesEnabled
  };
}

async function mapPatientOpinionRequestRows(rows: RequestListRow[]): Promise<OpinionRequest[]> {
  const mapped = rows.map((row) => mapRequestRow(row, new Map()));
  const withWorkflow = await enrichRequestsWithWorkflowFields(mapped);
  return attachRequestRecords(withWorkflow);
}

export async function fetchPatientOpinionRequestById(
  patientAuthUserId: string,
  requestId: string
): Promise<{ data: OpinionRequest | null; error: { message: string } | null }> {
  const selects = [
    requestListSelectPatient,
    stripDoctorSelectionModeFromSelect(requestListSelectPatient),
    stripRequestedSpecialtyFromSelect(requestListSelectPatient),
    stripRecordsVerifiedFromSelect(requestListSelectPatient),
    stripPatientCaseDetailsFromSelect(requestListSelectPatient),
    stripProceededWithoutRecordsFromSelect(requestListSelectPatient),
    `
      id,
      message,
      status,
      created_at,
      patient_id,
      patient_name,
      doctor_id,
      doctor_name,
      doctor_response,
      responded_at,
      assigned_to,
      assigned_at,
      coordination_notes,
      doctors (id, full_name, specialty)
    `
  ];

  let lastError: { message: string; code?: string } | null = null;

  for (const select of selects) {
    const { data, error } = await supabase
      .from('opinion_requests')
      .select(select)
      .eq('patient_id', patientAuthUserId)
      .eq('id', requestId)
      .maybeSingle<RequestListRow>();

    if (!error && data) {
      const [mapped] = await mapPatientOpinionRequestRows([data]);
      return { data: mapped ?? null, error: null };
    }

    if (error) {
      lastError = error;
      if (error.code === 'PGRST116') {
        return { data: null, error: { message: 'Request not found.' } };
      }
      const missingColumn =
        isMissingDoctorSelectionModeError(error) ||
        isMissingRequestedSpecialtyError(error) ||
        isMissingRecordsVerifiedColumnError(error) ||
        isMissingPatientCaseDetailsColumnError(error) ||
        isMissingProceedWithoutRecordsColumnError(error) ||
        isMissingWorkflowColumnsError(error);
      if (missingColumn) continue;
      return { data: null, error: { message: error.message } };
    }

    return { data: null, error: { message: 'Request not found.' } };
  }

  return {
    data: null,
    error: { message: lastError?.message ?? 'Request not found.' }
  };
}

async function mapStaffOpinionRequestRow(row: RequestListRow): Promise<OpinionRequest | null> {
  const authUserIds = row.patient_id ? [row.patient_id] : [];
  const patientMap = await loadPatientEmailMap(authUserIds);
  const mapped = mapRequestRow(row, patientMap);
  const [withWorkflow] = await enrichRequestsWithWorkflowFields([mapped]);
  const [withRecords] = await attachRequestRecords([withWorkflow]);
  const [enriched] = await enrichRequestsWithAssigneeNames(withRecords);
  return enriched ?? null;
}

/** Loads one staff-visible request with records and workflow fields (for live drawer refresh). */
export async function fetchStaffOpinionRequestById(
  requestId: string
): Promise<{ data: OpinionRequest | null; error: { message: string } | null }> {
  const selects = [
    requestListSelectWithResponse,
    stripDoctorSelectionModeFromSelect(requestListSelectWithResponse),
    stripRequestedSpecialtyFromSelect(requestListSelectWithResponse),
    stripRecordsVerifiedFromSelect(requestListSelectWithResponse),
    stripPatientCaseDetailsFromSelect(requestListSelectWithResponse),
    stripProceededWithoutRecordsFromSelect(requestListSelectWithResponse),
    stripExtendedWorkflowFromSelect(requestListSelectWithResponse),
    stripRecordsVerifiedFromSelect(stripExtendedWorkflowFromSelect(requestListSelectWithResponse)),
    requestListSelectWithResponseLegacy,
    requestListSelectWithResponseNoAssign,
    requestListSelectBase
  ];

  let lastError: { message: string; code?: string } | null = null;

  for (const select of selects) {
    const { data, error } = await supabase
      .from('opinion_requests')
      .select(select)
      .eq('id', requestId)
      .maybeSingle<RequestListRow>();

    if (!error && data) {
      const mapped = await mapStaffOpinionRequestRow(data);
      return { data: mapped, error: null };
    }

    if (error) {
      lastError = error;
      if (error.code === 'PGRST116') {
        return { data: null, error: { message: 'Request not found.' } };
      }
      const missingColumn =
        isMissingDoctorSelectionModeError(error) ||
        isMissingRequestedSpecialtyError(error) ||
        isMissingRecordsVerifiedColumnError(error) ||
        isMissingPatientCaseDetailsColumnError(error) ||
        isMissingProceedWithoutRecordsColumnError(error) ||
        isMissingWorkflowColumnsError(error);
      if (missingColumn) continue;
      return { data: null, error: { message: error.message } };
    }

    return { data: null, error: { message: 'Request not found.' } };
  }

  return {
    data: null,
    error: { message: lastError?.message ?? 'Request not found.' }
  };
}

/** Loads requests visible to the signed-in doctor (RLS policy opinion_requests_select_doctor). */
export async function fetchDoctorOpinionRequests(): Promise<FetchOpinionRequestsResult> {
  const { rows, error, responsesEnabled } = await fetchOpinionRequestRows();

  if (error) {
    return {
      data: null,
      error: { message: `${error.message}${permissionHint(error.code, error.message)}` },
      responsesEnabled: false
    };
  }

  const authUserIds = [...new Set((rows ?? []).map((r) => r.patient_id).filter(Boolean))] as string[];

  try {
    const patientMap = await loadPatientEmailMap(authUserIds);
    const mapped = (rows ?? []).map((row) => mapRequestRow(row, patientMap));
    const withWorkflow = await enrichRequestsWithWorkflowFields(mapped);
    const withRecords = await attachRequestRecords(withWorkflow);
    const data = await enrichRequestsWithConsultationSummaries(withRecords);
    return {
      data,
      error: null,
      responsesEnabled
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load patient details';
    return { data: null, error: { message }, responsesEnabled: false };
  }
}

/** Loads opinion requests visible to signed-in staff (administrator: all; PSE: assigned). */
export async function fetchOpinionRequestsForStaff(): Promise<FetchOpinionRequestsResult> {
  const { rows, error, responsesEnabled } = await fetchOpinionRequestRows();

  if (error) {
    return {
      data: null,
      error: { message: `${error.message}${permissionHint(error.code, error.message)}` },
      responsesEnabled: false
    };
  }

  const authUserIds = [...new Set((rows ?? []).map((r) => r.patient_id).filter(Boolean))] as string[];

  try {
    const patientMap = await loadPatientEmailMap(authUserIds);
    const mapped = (rows ?? []).map((row) => mapRequestRow(row, patientMap));
    const withWorkflow = await enrichRequestsWithWorkflowFields(mapped);
    const withRecords = await attachRequestRecords(withWorkflow);
    const data = await enrichRequestsWithAssigneeNames(withRecords);
    return {
      data,
      error: null,
      responsesEnabled
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load patient details';
    return { data: null, error: { message }, responsesEnabled: false };
  }
}

/** @deprecated Use fetchOpinionRequestsForStaff */
export const fetchAllOpinionRequestsForAdmin = fetchOpinionRequestsForStaff;

function isMissingDeletePolicyError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return error.code === '42501' || msg.includes('policy') || msg.includes('permission denied');
}

function isMissingDeleteRpcError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('admin_delete_opinion_request') ||
    msg.includes('admin_delete_patient_opinion_requests') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
}

const DELETE_MIGRATION_HINT =
  'Run npm run db:apply-admin-delete-requests or apply supabase/apply-admin-delete-requests-in-sql-editor.sql in the Supabase SQL Editor.';

async function deleteOpinionRequestDirect(requestId: string) {
  return supabase.from('opinion_requests').delete().eq('id', requestId).select('id');
}

/** Permanently delete one opinion request (admin only). Cascades related rows. */
export async function deleteOpinionRequestForAdmin(requestId: string) {
  const { data: rpcOk, error: rpcError } = await supabase.rpc('admin_delete_opinion_request', {
    p_request_id: requestId
  });

  if (!rpcError) {
    if (rpcOk === true) {
      await logRequestAudit(requestId, 'request_deleted', 'administrator');
      return { data: [{ id: requestId }], error: null };
    }
    return { data: null, error: { message: 'Request not found or could not be deleted.' } };
  }

  if (!isMissingDeleteRpcError(rpcError)) {
    if (isMissingDeletePolicyError(rpcError)) {
      return { data: null, error: { message: `Delete is not enabled in the database. ${DELETE_MIGRATION_HINT}` } };
    }
    const msg = rpcError.message ?? '';
    if (msg.toLowerCase().includes('administrator access required')) {
      return {
        data: null,
        error: { message: 'Only administrators can delete requests. Sign in with an admin account.' }
      };
    }
    return { data: null, error: rpcError };
  }

  const { data, error } = await deleteOpinionRequestDirect(requestId);

  if (error) {
    if (isMissingDeletePolicyError(error)) {
      return {
        data: null,
        error: { message: `Delete is not enabled in the database. ${DELETE_MIGRATION_HINT}` }
      };
    }
    return { data: null, error };
  }

  if (!data?.length) {
    return {
      data: null,
      error: {
        message: `Request could not be deleted. ${DELETE_MIGRATION_HINT}`
      }
    };
  }

  await logRequestAudit(requestId, 'request_deleted', 'administrator');
  return { data, error: null };
}

/** Count opinion requests for a patient auth user (admin). */
export async function countOpinionRequestsForPatient(patientAuthUserId: string) {
  const { count, error } = await supabase
    .from('opinion_requests')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientAuthUserId);

  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/** Pending open opinion requests linked to a doctor (admin). */
async function fetchPendingOpinionRequestsForDoctorForAdmin(doctorId: string) {
  const byId = new Map<
    string,
    { id: string; doctor_id: string | null; selected_doctor_id: string | null }
  >();

  const { data: directRows, error: directError } = await supabase
    .from('opinion_requests')
    .select('id, doctor_id, selected_doctor_id')
    .neq('status', 'closed')
    .or(`doctor_id.eq.${doctorId},selected_doctor_id.eq.${doctorId}`);

  if (directError) return { requests: [], error: directError };
  directRows?.forEach((row) => byId.set(row.id, row));

  const { data: recommendationRows, error: recommendationError } = await supabase
    .from('opinion_request_recommendations')
    .select('request_id')
    .eq('doctor_id', doctorId);

  if (recommendationError) return { requests: [...byId.values()], error: recommendationError };

  const recommendedRequestIds = [
    ...new Set(
      (recommendationRows ?? [])
        .map((row) => row.request_id)
        .filter((requestId): requestId is string => Boolean(requestId) && !byId.has(requestId))
    )
  ];

  if (recommendedRequestIds.length > 0) {
    const { data: recommendedRequests, error: recommendedRequestsError } = await supabase
      .from('opinion_requests')
      .select('id, doctor_id, selected_doctor_id')
      .neq('status', 'closed')
      .in('id', recommendedRequestIds);

    if (recommendedRequestsError) {
      return { requests: [...byId.values()], error: recommendedRequestsError };
    }
    recommendedRequests?.forEach((row) => byId.set(row.id, row));
  }

  return { requests: [...byId.values()], error: null };
}

/** Count open (non-closed) opinion requests linked to a doctor (admin). */
export async function countPendingOpinionRequestsForDoctorForAdmin(doctorId: string) {
  const { requests, error } = await fetchPendingOpinionRequestsForDoctorForAdmin(doctorId);
  if (error) return { count: 0, error };
  return { count: requests.length, error: null };
}

/** Route a doctor's open cases to a PSE before admin deletes the doctor profile. */
export async function reassignPendingOpinionRequestsToPseForAdmin(
  fromDoctorId: string,
  pseAdminId: string,
  input?: { removedDoctorName?: string | null }
) {
  const trimmedPseId = pseAdminId.trim();
  if (!trimmedPseId) {
    return { reassignedCount: 0, error: { message: 'Select a patient service executive.' } };
  }

  const { requests, error: fetchError } = await fetchPendingOpinionRequestsForDoctorForAdmin(fromDoctorId);
  if (fetchError) return { reassignedCount: 0, error: fetchError };
  if (requests.length === 0) return { reassignedCount: 0, error: null };

  const removedDoctorName = input?.removedDoctorName?.trim() || 'The assigned doctor';
  const coordinationNote = `${removedDoctorName} was removed from the platform. Please assign a replacement specialist and continue coordination.`;

  const { error: deleteRecommendationsError } = await supabase
    .from('opinion_request_recommendations')
    .delete()
    .eq('doctor_id', fromDoctorId);

  if (deleteRecommendationsError) {
    return { reassignedCount: 0, error: deleteRecommendationsError };
  }

  let reassignedCount = 0;

  for (const request of requests) {
    const patch: Record<string, unknown> = {
      status: 'submitted',
      coordination_notes: coordinationNote
    };

    if (request.doctor_id === fromDoctorId) {
      patch.doctor_id = null;
      patch.doctor_name = null;
    }
    if (request.selected_doctor_id === fromDoctorId) {
      patch.selected_doctor_id = null;
    }

    const { error: updateError } = await supabase
      .from('opinion_requests')
      .update(patch)
      .eq('id', request.id);

    if (updateError) return { reassignedCount, error: updateError };

    const { error: assignError } = await assignOpinionRequest(request.id, trimmedPseId);
    if (assignError) return { reassignedCount, error: assignError };

    reassignedCount += 1;
  }

  return { reassignedCount: requests.length, error: null };
}

/** Delete all opinion requests for a patient (admin only). */
export async function deleteAllOpinionRequestsForPatientForAdmin(patientAuthUserId: string) {
  const { data: rpcCount, error: rpcError } = await supabase.rpc(
    'admin_delete_patient_opinion_requests',
    { p_patient_auth_user_id: patientAuthUserId }
  );

  if (!rpcError) {
    const deletedCount = typeof rpcCount === 'number' ? rpcCount : Number(rpcCount) || 0;
    return { data: null, deletedCount, error: null };
  }

  if (!isMissingDeleteRpcError(rpcError)) {
    if (isMissingDeletePolicyError(rpcError)) {
      return {
        data: null,
        deletedCount: 0,
        error: { message: `Delete is not enabled in the database. ${DELETE_MIGRATION_HINT}` }
      };
    }
    return { data: null, deletedCount: 0, error: rpcError };
  }

  const { data, error } = await supabase
    .from('opinion_requests')
    .delete()
    .eq('patient_id', patientAuthUserId)
    .select('id');

  if (error) {
    if (isMissingDeletePolicyError(error)) {
      return {
        data: null,
        deletedCount: 0,
        error: { message: `Delete is not enabled in the database. ${DELETE_MIGRATION_HINT}` }
      };
    }
    return { data: null, deletedCount: 0, error };
  }

  return { data, deletedCount: data?.length ?? 0, error: null };
}

// -----------------------------------------------------------------------------
// Consultation workflow mutations
// -----------------------------------------------------------------------------

async function logRequestAudit(
  requestId: string,
  action: OpinionRequestAuditAction,
  actorRole: OpinionRequestAuditActorRole,
  options?: { summary?: string; metadata?: Record<string, unknown>; actorName?: string | null }
) {
  return recordOpinionRequestAudit(requestId, action, { actorRole, ...options });
}

export async function pseMarkRecordsVerified(requestId: string) {
  const verifiedAt = new Date().toISOString();
  let { data, error } = await supabase
    .from('opinion_requests')
    .update({ records_verified_at: verifiedAt })
    .eq('id', requestId)
    .select('id, records_verified_at')
    .single();

  if (error && isMissingRecordsVerifiedColumnError(error)) {
    return {
      data: null,
      error: {
        message:
          'Records verification requires migration 021. Run npm run db:apply-records-verified or apply supabase/migrations/021_records_verified.sql in the Supabase SQL Editor.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'records_verified', 'pse', {
    metadata: { records_verified_at: verifiedAt }
  });
  return { data, error: null };
}

export async function pseMarkCaseDetailsReviewed(requestId: string) {
  const reviewedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({ case_details_reviewed_at: reviewedAt })
    .eq('id', requestId)
    .select('id, case_details_reviewed_at')
    .single();

  if (error && isMissingCaseDetailsReviewedColumnError(error)) {
    return {
      data: null,
      error: {
        message:
          'Case details review requires a DB migration. Add column case_details_reviewed_at (timestamptz) to the opinion_requests table.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'case_details_reviewed', 'pse', {
    metadata: { reviewed_at: reviewedAt }
  });
  return { data, error: null };
}

export async function pseRejectRecords(requestId: string, reason: string) {
  const rejectedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      records_rejected_at: rejectedAt,
      records_rejection_reason: reason.trim()
    })
    .eq('id', requestId)
    .select('id, records_rejected_at')
    .single();

  if (error && isMissingRecordsRejectedColumnError(error)) {
    return {
      data: null,
      error: {
        message:
          'Records rejection requires a DB migration. Add columns records_rejected_at (timestamptz) and records_rejection_reason (text) to opinion_requests.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'records_rejected', 'pse', {
    metadata: { reason, rejected_at: rejectedAt }
  });
  return { data, error: null };
}

export async function patientProceedWithoutRecords(requestId: string) {
  const proceededAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      patient_proceeded_without_records_at: proceededAt,
      records_rejected_at: null,
      records_rejection_reason: null
    })
    .eq('id', requestId)
    .select('id, patient_proceeded_without_records_at')
    .single();

  if (error && isMissingProceedWithoutRecordsColumnError(error)) {
    return {
      data: null,
      error: {
        message:
          'Proceed without records requires migration 042. Run npm run db:apply-proceeded-without-records or apply supabase/migrations/042_proceeded_without_records.sql in the Supabase SQL Editor.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'patient_proceeded_without_records', 'patient', {
    metadata: { proceeded_at: proceededAt }
  });
  notifyOpinionRequestLiveChange(requestId);
  return { data, error: null };
}

export async function patientAttachRecordsToRequest(requestId: string, recordIds: string[]) {
  const uniqueIds = [...new Set(recordIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) {
    return {
      data: null,
      error: { message: 'Select or upload at least one record to attach.' }
    };
  }

  const { data: existingLinks, error: existingError } = await supabase
    .from('opinion_request_records')
    .select('record_id')
    .eq('request_id', requestId);

  if (existingError) return { data: null, error: existingError };

  const existingIds = new Set((existingLinks ?? []).map((link) => link.record_id));
  const newIds = uniqueIds.filter((id) => !existingIds.has(id));

  if (!newIds.length) {
    return {
      data: null,
      error: { message: 'These records are already attached to this request.' }
    };
  }

  const links = newIds.map((recordId) => ({
    request_id: requestId,
    record_id: recordId
  }));
  const { error: linkError } = await supabase.from('opinion_request_records').insert(links);

  if (linkError) {
    const hint =
      linkError.message?.includes('foreign key') || linkError.message?.includes('record_id')
        ? ' Run supabase/migrations/020_opinion_request_files_access.sql in the Supabase SQL Editor.'
        : '';
    return { data: null, error: { message: `${linkError.message}${hint}` } };
  }

  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      patient_proceeded_without_records_at: null,
      records_rejected_at: null,
      records_rejection_reason: null
    })
    .eq('id', requestId)
    .select('id')
    .single();

  if (error && isMissingProceedWithoutRecordsColumnError(error)) {
    const { error: fallbackError } = await supabase
      .from('opinion_requests')
      .update({
        records_rejected_at: null,
        records_rejection_reason: null
      })
      .eq('id', requestId);
    if (fallbackError) return { data: null, error: fallbackError };
  } else if (error) {
    return { data: null, error };
  }

  await logRequestAudit(requestId, 'patient_records_attached', 'patient', {
    metadata: { record_ids: newIds, count: newIds.length }
  });
  notifyOpinionRequestLiveChange(requestId);
  return { data: { attachedCount: newIds.length, id: data?.id ?? requestId }, error: null };
}

export function canPatientManageRequestRecords(
  request: Pick<OpinionRequest, 'records_verified_at' | 'status'>
): boolean {
  return !request.records_verified_at && request.status !== 'closed';
}

export async function patientDetachRecordFromRequest(requestId: string, recordId: string) {
  const trimmedId = recordId.trim();
  if (!trimmedId) {
    return { data: null, error: { message: 'Record id is required.' } };
  }

  const { error } = await supabase
    .from('opinion_request_records')
    .delete()
    .eq('request_id', requestId)
    .eq('record_id', trimmedId);

  if (error) {
    const hint = error.message?.toLowerCase().includes('policy')
      ? ' Detaching records requires migration 043. Apply supabase/migrations/043_patient_detach_request_records.sql in the Supabase SQL Editor.'
      : '';
    return { data: null, error: { message: `${error.message}${hint}` } };
  }

  await logRequestAudit(requestId, 'patient_record_detached', 'patient', {
    metadata: { record_id: trimmedId }
  });
  notifyOpinionRequestLiveChange(requestId);
  return { data: { recordId: trimmedId }, error: null };
}

export async function pseProceedWithoutRecords(requestId: string) {
  const proceededAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({ pse_proceeded_without_records_at: proceededAt })
    .eq('id', requestId)
    .select('id, pse_proceeded_without_records_at')
    .single();

  if (error && isMissingProceedWithoutRecordsColumnError(error)) {
    return {
      data: null,
      error: {
        message:
          'Proceed without records requires migration 042. Run npm run db:apply-proceeded-without-records or apply supabase/migrations/042_proceeded_without_records.sql in the Supabase SQL Editor.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'pse_proceeded_without_records', 'pse', {
    metadata: { proceeded_at: proceededAt }
  });
  notifyOpinionRequestLiveChange(requestId);
  return { data, error: null };
}

export async function updatePatientCaseDetails(
  requestId: string,
  caseDetails: Record<string, unknown>,
  options?: {
    actorRole?: 'patient' | 'pse';
    syncMessage?: boolean;
    requestedSpecialty?: string | null;
  }
) {
  const actorRole = options?.actorRole ?? 'patient';
  const primaryHealthConcern =
    typeof caseDetails.primaryHealthConcern === 'string' ? caseDetails.primaryHealthConcern.trim() : '';

  const payload: Record<string, unknown> = {
    patient_case_details: caseDetails
  };

  if (options?.syncMessage && primaryHealthConcern) {
    payload.message = primaryHealthConcern;
  }

  if (options?.requestedSpecialty?.trim()) {
    payload.requested_specialty = options.requestedSpecialty.trim();
  }

  const { data, error } = await supabase
    .from('opinion_requests')
    .update(payload)
    .eq('id', requestId)
    .select('id, patient_case_details, message, requested_specialty')
    .single();

  if (error && isMissingPatientCaseDetailsColumnError(error)) {
    return {
      data: null,
      error: {
        message:
          'Patient case details require migration 041. Run supabase/migrations/041_patient_case_details.sql in the Supabase SQL Editor.'
      }
    };
  }

  if (error) return { data: null, error };
  if (!data) {
    return {
      data: null,
      error: { message: 'Case details could not be saved. Check your connection and try again.' }
    };
  }
  await logRequestAudit(requestId, 'case_details_updated', actorRole);
  notifyOpinionRequestLiveChange(requestId, 'case_details_updated', {
    patient_case_details: data.patient_case_details,
    message: data.message,
    requested_specialty: data.requested_specialty
  });
  return { data, error: null };
}

export async function saveOpinionRequestRecommendations(
  requestId: string,
  input: Array<{ doctorId: string; rank?: number | null; note?: string | null }>
) {
  // Replace list: delete then insert
  const { error: deleteError } = await supabase
    .from('opinion_request_recommendations')
    .delete()
    .eq('request_id', requestId);
  if (deleteError) return { data: null, error: deleteError };

  if (!input.length) return { data: [], error: null };

  const payload = input.map((item) => ({
    request_id: requestId,
    doctor_id: item.doctorId,
    rank: item.rank ?? null,
    note: item.note?.trim() || null
  }));

  const { data, error } = await supabase
    .from('opinion_request_recommendations')
    .insert(payload)
    .select('id, request_id, doctor_id, rank, note, created_at');

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'doctors_recommended', 'pse', {
    metadata: { recommendation_count: input.length }
  });
  return { data: (data ?? []) as unknown as OpinionRequestRecommendation[], error: null };
}

export async function fetchOpinionRequestRecommendations(requestId: string) {
  const { data, error } = await supabase
    .from('opinion_request_recommendations')
    .select(
      `
      id,
      request_id,
      doctor_id,
      rank,
      note,
      created_at,
      doctors (
        full_name,
        specialty,
        consultation_tiers,
        consultation_fee,
        fee_usd,
        consultation_currency
      )
    `
    )
    .eq('request_id', requestId)
    .order('rank', { ascending: true, nullsFirst: true })
    .returns<
      Array<
        Omit<OpinionRequestRecommendation, 'doctor_name' | 'doctor_specialty' | 'doctor_consultation_tiers'> & {
          doctors: {
            full_name: string;
            specialty: string;
            consultation_tiers: unknown;
            consultation_fee: number | null;
            fee_usd: number | null;
            consultation_currency: string | null;
          } | null;
        }
      >
    >();

  if (error) return { data: null, error };
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      request_id: row.request_id,
      doctor_id: row.doctor_id,
      rank: row.rank,
      note: row.note,
      created_at: row.created_at,
      doctor_name: row.doctors?.full_name ?? null,
      doctor_specialty: row.doctors?.specialty ?? null,
      doctor_consultation_tiers: row.doctors
        ? parseConsultationTiers(
            row.doctors.consultation_tiers,
            Number(row.doctors.consultation_fee ?? row.doctors.fee_usd ?? 0)
          )
        : null,
      doctor_consultation_currency: row.doctors
        ? normalizeConsultationCurrency(row.doctors.consultation_currency)
        : null
    })),
    error: null
  };
}

export async function markRecommendationsShared(
  requestId: string,
  input?: { consultationDurationMinutes?: number }
) {
  const update: Record<string, unknown> = { consultation_stage: 'recommended' };
  if (input?.consultationDurationMinutes != null) {
    update.consultation_duration_minutes = input.consultationDurationMinutes;
  }

  let { data, error } = await supabase
    .from('opinion_requests')
    .update(update)
    .eq('id', requestId)
    .select('id, consultation_stage, consultation_duration_minutes')
    .single();

  if (error && isMissingWorkflowColumnsError(error)) {
    return {
      data: null,
      error: {
        message:
          'Consultation workflow is not enabled in the database. Run npm run db:apply-consultation-workflow or apply supabase/migrations/019_consultation_workflow.sql.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'recommendations_shared', 'pse');
  return { data, error: null };
}

export async function patientSelectRecommendedDoctor(
  requestId: string,
  doctorId: string,
  input?: {
    consultationDurationMinutes?: number | null;
    recommendation?: ResolveDoctorRecommendationHint;
  }
) {
  const { doctor, error: doctorError } = await resolveDoctorRecord(doctorId, {
    requestId,
    recommendation: input?.recommendation
  });
  if (doctorError || !doctor) {
    return { data: null, error: doctorError ?? { message: 'Doctor not found.' } };
  }

  const durationMinutes = input?.consultationDurationMinutes ?? null;
  const consultationFeeUsd =
    durationMinutes != null ? getTierFeeUsd(doctor, durationMinutes) : null;

  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      selected_doctor_id: doctor.id,
      doctor_id: doctor.id,
      doctor_name: doctor.full_name,
      consultation_stage: 'doctor_selected',
      ...(durationMinutes != null
        ? {
            consultation_duration_minutes: durationMinutes,
            consultation_fee_usd: consultationFeeUsd,
            consultation_currency: doctorConsultationCurrency(doctor)
          }
        : {})
    })
    .eq('id', requestId)
    .select('id, selected_doctor_id, doctor_id, consultation_stage, consultation_duration_minutes, consultation_fee_usd, consultation_currency')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'doctor_selected', 'patient', {
    metadata: { doctor_id: doctor.id, doctor_name: doctor.full_name }
  });
  return { data, error: null };
}

/** Patient picks a doctor and preferred appointment time in one step (routes to PSE for review). */
export async function patientSelectDoctorWithAvailability(
  requestId: string,
  doctorId: string,
  availability: unknown,
  input?: {
    consultationDurationMinutes?: number | null;
    recommendation?: ResolveDoctorRecommendationHint;
  }
) {
  const { doctor, error: doctorError } = await resolveDoctorRecord(doctorId, {
    requestId,
    recommendation: input?.recommendation
  });
  if (doctorError || !doctor) {
    return { data: null, error: doctorError ?? { message: 'Doctor not found.' } };
  }

  const durationMinutes = input?.consultationDurationMinutes ?? null;
  const consultationFeeUsd =
    durationMinutes != null ? getTierFeeUsd(doctor, durationMinutes) : null;

  const payload = {
    selected_doctor_id: doctor.id,
    doctor_id: doctor.id,
    doctor_name: doctor.full_name,
    patient_availability: availability,
    consultation_stage: 'availability_submitted' as const,
    ...(durationMinutes != null
      ? {
          consultation_duration_minutes: durationMinutes,
          consultation_fee_usd: consultationFeeUsd,
          consultation_currency: doctorConsultationCurrency(doctor)
        }
      : {})
  };

  let { data, error } = await supabase
    .from('opinion_requests')
    .update(payload)
    .eq('id', requestId)
    .select('id, selected_doctor_id, doctor_id, doctor_name, patient_availability, consultation_stage')
    .single();

  if (error && isMissingWorkflowColumnsError(error)) {
    return {
      data: null,
      error: {
        message:
          'Consultation workflow is not enabled in the database. Run npm run db:apply-consultation-workflow (migration 019).'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'doctor_and_availability_submitted', 'patient', {
    metadata: { doctor_id: doctor.id, doctor_name: doctor.full_name }
  });
  return { data, error: null };
}

export async function patientSubmitAvailability(requestId: string, availability: unknown) {
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      patient_availability: availability,
      consultation_stage: 'availability_submitted'
    })
    .eq('id', requestId)
    .select('id, consultation_stage')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'availability_submitted', 'patient');
  return { data, error: null };
}

/** PSE confirms the doctor is free at the patient's requested time and proposes a slot for patient approval. */
export async function pseProposeConfirmedSchedule(
  requestId: string,
  input: { scheduledAt: string; message?: string | null }
) {
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      scheduled_at: input.scheduledAt,
      pse_scheduling_message: input.message?.trim() || null,
      consultation_stage: 'schedule_proposed'
    })
    .eq('id', requestId)
    .select('id, scheduled_at, pse_scheduling_message, consultation_stage')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'schedule_proposed', 'pse', {
    metadata: { scheduled_at: input.scheduledAt }
  });
  return { data, error: null };
}

/** PSE informs the patient the doctor is not available at the requested time; offers alternative slots. */
export async function pseProposeScheduleAlternatives(
  requestId: string,
  input: { alternativeSlots: string; message?: string | null }
) {
  const trimmed = input.alternativeSlots.trim();
  if (!trimmed) {
    return { data: null, error: { message: 'Enter alternative dates and times for the patient.' } };
  }
  const combined = input.message?.trim()
    ? `${input.message.trim()}\n\n${trimmed}`
    : trimmed;
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      pse_scheduling_message: combined,
      consultation_stage: 'schedule_proposed'
    })
    .eq('id', requestId)
    .select('id, pse_scheduling_message, consultation_stage')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'schedule_alternatives_proposed', 'pse');
  return { data, error: null };
}

/** PSE approves the patient's doctor selection so the workflow can continue to payment. */
export async function pseApprovePatientSelection(requestId: string) {
  const confirmedAt = new Date().toISOString();
  let { data, error } = await supabase
    .from('opinion_requests')
    .update({
      consultation_stage: 'schedule_confirmed',
      schedule_confirmed_at: confirmedAt
    })
    .eq('id', requestId)
    .select('id, consultation_stage, schedule_confirmed_at')
    .single();

  if (error && isMissingWorkflowColumnsError(error)) {
    const retry = await supabase
      .from('opinion_requests')
      .update({ consultation_stage: 'schedule_confirmed' })
      .eq('id', requestId)
      .select('id, consultation_stage')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'patient_selection_approved', 'pse');
  return { data, error: null };
}

/** Patient accepts the proposed schedule (or alternatives) so PSE can send payment. */
export async function patientConfirmSchedule(requestId: string) {
  const confirmedAt = new Date().toISOString();
  let { data, error } = await supabase
    .from('opinion_requests')
    .update({
      consultation_stage: 'schedule_confirmed',
      schedule_confirmed_at: confirmedAt
    })
    .eq('id', requestId)
    .select('id, consultation_stage, schedule_confirmed_at')
    .single();

  if (error && isMissingWorkflowColumnsError(error)) {
    const retry = await supabase
      .from('opinion_requests')
      .update({ consultation_stage: 'schedule_confirmed' })
      .eq('id', requestId)
      .select('id, consultation_stage')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'schedule_confirmed', 'patient', {
    metadata: { schedule_confirmed_at: confirmedAt }
  });
  return { data, error: null };
}

function paymentProofMimeForFile(file: File): string {
  const type = file.type?.trim().toLowerCase();
  if (type && PAYMENT_PROOF_ACCEPTED_TYPES.has(type)) return type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export function paymentProofValidationError(file: File): string | null {
  if (file.size < 1 || file.size > PAYMENT_PROOF_MAX_BYTES) {
    return 'Payment proof must be between 1 byte and 10 MB.';
  }
  const mime = paymentProofMimeForFile(file);
  if (!PAYMENT_PROOF_ACCEPTED_TYPES.has(mime)) {
    return 'Upload a screenshot or receipt (JPEG, PNG, WebP, or PDF).';
  }
  return null;
}

/** Patient shares payment screenshot after paying via the external link. */
export async function patientSubmitPaymentProof(requestId: string, file: File) {
  const validationError = paymentProofValidationError(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  if (!isR2StorageConfigured()) {
    return {
      data: null,
      error: { message: 'File storage is not configured. Contact support to share your payment proof.' }
    };
  }

  const contentType = paymentProofMimeForFile(file);
  const { data: uploadTarget, error: presignError } = await createR2UploadUrl(file);
  if (presignError || !uploadTarget) {
    return { data: null, error: presignError ?? { message: 'Could not prepare upload.' } };
  }

  const { error: uploadError } = await uploadFileToR2(
    uploadTarget.uploadUrl,
    file,
    contentType,
    uploadTarget.storagePath
  );
  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const submittedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      payment_proof_storage_path: uploadTarget.storagePath,
      payment_proof_file_name: file.name,
      payment_proof_mime_type: contentType,
      payment_proof_submitted_at: submittedAt,
      payment_status: 'pending',
      consultation_stage: 'payment_pending'
    })
    .eq('id', requestId)
    .select(
      'id, payment_proof_storage_path, payment_proof_file_name, payment_proof_mime_type, payment_proof_submitted_at, payment_status, consultation_stage'
    )
    .single();

  if (error) {
    if (isMissingWorkflowColumnsError(error)) {
      return {
        data: null,
        error: {
          message:
            'Payment proof is not enabled in the database. Run npm run db:apply-payment-proof or apply supabase/migrations/026_payment_proof.sql.'
        }
      };
    }
    return { data: null, error };
  }

  await logRequestAudit(requestId, 'payment_proof_submitted', 'patient', {
    metadata: { file_name: file.name, submitted_at: submittedAt }
  });
  return { data, error: null };
}

/** PSE generates a consultation invoice PDF for the patient before sending payment. */
async function uploadConsultationInvoicePdf(
  request: OpinionRequest,
  input: { amount: number; currency: string; doctor: Doctor }
) {
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { data: null, error: { message: 'Consultation fee is missing for this request.' } };
  }

  if (!isR2StorageConfigured()) {
    return {
      data: null,
      error: {
        message:
          'File storage is not configured. Set VITE_R2_API_URL so consultation invoices can be saved.'
      }
    };
  }

  const currency = normalizeConsultationCurrency(input.currency);
  const totals = computeConsultationInvoiceTotals(amount, currency);
  const issuedAt = new Date();
  const invoiceNumber = buildConsultationInvoiceNumber(request.id, issuedAt);

  const blob = await generateConsultationInvoicePdfBlob({
    invoiceNumber,
    issuedAt,
    patientName: request.patient_name,
    patientEmail: request.patient_email,
    requestId: request.id,
    doctor: input.doctor,
    durationMinutes: request.consultation_duration_minutes,
    currency,
    totals
  });

  const file = new File([blob], `consultation-invoice-${request.id}.pdf`, {
    type: 'application/pdf'
  });

  const { data: uploadTarget, error: presignError } = await createConsultationInvoiceUploadUrl(
    request.id,
    file.size
  );
  if (presignError || !uploadTarget) {
    return { data: null, error: presignError ?? { message: 'Could not prepare invoice upload.' } };
  }

  const { error: uploadError } = await uploadFileToR2(
    uploadTarget.uploadUrl,
    file,
    'application/pdf',
    uploadTarget.storagePath
  );
  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return {
    data: {
      storagePath: uploadTarget.storagePath,
      invoiceNumber,
      issuedAt: issuedAt.toISOString(),
      totals,
      currency
    },
    error: null
  };
}

function consultationInvoiceDbPayload(upload: {
  storagePath: string;
  invoiceNumber: string;
  issuedAt: string;
  totals: ReturnType<typeof computeConsultationInvoiceTotals>;
}) {
  return {
    invoice_pdf_storage_path: upload.storagePath,
    invoice_generated_at: upload.issuedAt,
    invoice_number: upload.invoiceNumber,
    invoice_subtotal: upload.totals.subtotal,
    invoice_tax_rate: upload.totals.taxRate,
    invoice_tax_amount: upload.totals.taxAmount,
    invoice_total: upload.totals.total
  };
}

const invoiceSelectFields =
  'id, invoice_pdf_storage_path, invoice_generated_at, invoice_number, invoice_subtotal, invoice_tax_rate, invoice_tax_amount, invoice_total, payment_link, payment_status, consultation_stage, payment_amount, payment_currency';

export async function pseGenerateConsultationInvoice(
  request: OpinionRequest,
  input: { amount: number; currency: string; doctor: Doctor }
) {
  const uploaded = await uploadConsultationInvoicePdf(request, input);
  if (uploaded.error || !uploaded.data) {
    return { data: null, error: uploaded.error };
  }

  const payload = consultationInvoiceDbPayload(uploaded.data);

  let { data, error } = await supabase
    .from('opinion_requests')
    .update(payload)
    .eq('id', request.id)
    .select(invoiceSelectFields)
    .single();

  if (error && isMissingWorkflowColumnsError(error)) {
    return {
      data: null,
      error: {
        message:
          'Consultation invoice is not enabled in the database. Run npm run db:apply-consultation-invoice or apply supabase/migrations/037_consultation_invoice.sql.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(request.id, 'invoice_generated', 'pse', {
    metadata: { invoice_number: payload.invoice_number }
  });
  return { data, error: null };
}

/** Generate invoice PDF and send payment link in one request update (better realtime for patients). */
export async function pseSendInvoiceAndPaymentLink(
  request: OpinionRequest,
  input: { paymentLink: string; amount: number; currency: string; doctor: Doctor }
) {
  const link = input.paymentLink.trim();
  if (!link) {
    return { data: null, error: { message: 'Enter a payment link for the patient.' } };
  }

  const uploaded = await uploadConsultationInvoicePdf(request, input);
  if (uploaded.error || !uploaded.data) {
    return { data: null, error: uploaded.error };
  }

  const payload = {
    ...consultationInvoiceDbPayload(uploaded.data),
    payment_link: link,
    payment_status: 'pending' as const,
    consultation_stage: 'payment_pending' as const,
    payment_amount: uploaded.data.totals.total,
    payment_currency: uploaded.data.currency
  };

  let { data, error } = await supabase
    .from('opinion_requests')
    .update(payload)
    .eq('id', request.id)
    .select(invoiceSelectFields)
    .single();

  if (error && isMissingWorkflowColumnsError(error)) {
    return {
      data: null,
      error: {
        message:
          'Consultation invoice is not enabled in the database. Run npm run db:apply-consultation-invoice or apply supabase/migrations/037_consultation_invoice.sql.'
      }
    };
  }

  if (error) return { data: null, error };
  await logRequestAudit(request.id, 'invoice_and_payment_sent', 'pse', {
    metadata: { payment_amount: uploaded.data.totals.total, payment_currency: uploaded.data.currency }
  });
  return { data, error: null };
}

/** PSE sends payment link after schedule is confirmed by the patient. */
export async function pseSendPaymentLink(
  requestId: string,
  input: { paymentLink: string; amount?: number | null; currency?: string | null },
  options?: { requireInvoice?: boolean; invoiceStoragePath?: string | null }
) {
  const link = input.paymentLink.trim();
  if (!link) {
    return { data: null, error: { message: 'Enter a payment link for the patient.' } };
  }
  if (options?.requireInvoice && !options.invoiceStoragePath?.trim()) {
    return {
      data: null,
      error: { message: 'Generate the consultation invoice before sending the payment link.' }
    };
  }
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      payment_link: link,
      payment_status: 'pending',
      consultation_stage: 'payment_pending',
      payment_amount: input.amount ?? null,
      payment_currency: input.currency?.trim() || null
    })
    .eq('id', requestId)
    .select('id, payment_link, payment_status, consultation_stage, payment_amount, payment_currency')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'payment_link_sent', 'pse', {
    metadata: { payment_amount: input.amount ?? null, payment_currency: input.currency ?? null }
  });
  return { data, error: null };
}

export async function pseScheduleAppointment(
  requestId: string,
  input: { scheduledAt: string; meetingLink?: string | null }
) {
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      scheduled_at: input.scheduledAt,
      meeting_link: input.meetingLink?.trim() || null,
      consultation_stage: 'scheduled'
    })
    .eq('id', requestId)
    .select('id, scheduled_at, meeting_link, consultation_stage')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'appointment_scheduled', 'pse', {
    metadata: { scheduled_at: input.scheduledAt, meeting_link: input.meetingLink?.trim() || null }
  });
  return { data, error: null };
}

export async function pseSetPaymentPending(requestId: string) {
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({ payment_status: 'pending', consultation_stage: 'payment_pending' })
    .eq('id', requestId)
    .select('id, payment_status, consultation_stage')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'payment_pending_set', 'pse');
  return { data, error: null };
}

export async function pseConfirmPayment(
  requestId: string,
  input: { amount?: number | null; currency?: string | null; reference?: string | null }
) {
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({
      payment_status: 'paid',
      payment_amount: input.amount ?? null,
      payment_currency: input.currency?.trim() || null,
      payment_reference: input.reference?.trim() || null,
      payment_confirmed_at: new Date().toISOString(),
      consultation_stage: 'paid'
    })
    .eq('id', requestId)
    .select('id, payment_status, consultation_stage, payment_confirmed_at')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'payment_confirmed', 'pse', {
    metadata: {
      payment_amount: input.amount ?? null,
      payment_currency: input.currency ?? null,
      payment_reference: input.reference?.trim() || null
    }
  });
  return { data, error: null };
}

export async function pseReleaseToDoctor(requestId: string) {
  const { data, error } = await supabase
    .from('opinion_requests')
    .update({ status: 'in_review' })
    .eq('id', requestId)
    .select('id, status')
    .single();
  if (error) return { data: null, error };
  await logRequestAudit(requestId, 'released_to_doctor', 'pse');
  return { data, error: null };
}

export async function fetchPatientConsultationSummaries(patientAuthUserId: string) {
  const { data, error } = await supabase
    .from('consultation_summaries')
    .select(
      `
      id,
      request_id,
      doctor_id,
      patient_auth_user_id,
      chief_complaint,
      history_present_illness,
      vital_signs,
      current_medications,
      labs_diagnostics,
      assessment_plan,
      prescription,
      pdf_storage_path,
      created_at,
      updated_at
    `
    )
    .eq('patient_auth_user_id', patientAuthUserId)
    .order('created_at', { ascending: false })
    .returns<ConsultationSummary[]>();

  if (error) return { data: null, error };
  return { data: data ?? [], error: null };
}

const CONSULTATION_SUMMARY_SELECT = `
  id,
  request_id,
  doctor_id,
  patient_auth_user_id,
  chief_complaint,
  history_present_illness,
  vital_signs,
  current_medications,
  labs_diagnostics,
  assessment_plan,
  prescription,
  pdf_storage_path,
  created_at,
  updated_at
`;

export async function fetchConsultationSummary(requestId: string) {
  const { data, error } = await supabase
    .from('consultation_summaries')
    .select(CONSULTATION_SUMMARY_SELECT)
    .eq('request_id', requestId)
    .maybeSingle<ConsultationSummary>();

  if (error) return { data: null, error };
  return { data: data ?? null, error: null };
}

function shouldCloseRequestAfterConsultation(request: OpinionRequest): boolean {
  return (
    request.payment_status === 'paid' ||
    request.consultation_stage === 'paid' ||
    request.consultation_stage === 'completed'
  );
}

/** Doctor submits structured consultation notes, uploads PDF to R2, and updates the request. */
export async function saveDoctorConsultation(
  requestId: string,
  request: OpinionRequest,
  input: Omit<ConsultationSummary, 'id' | 'request_id' | 'created_at' | 'updated_at' | 'pdf_storage_path'>,
  responseText: string,
  doctorProfile?: Doctor | null
) {
  const trimmedResponse = responseText.trim();
  if (!trimmedResponse) {
    return { data: null, error: { message: 'Write your response before sending.' } };
  }

  const sessionToken = await ensureFreshAccessToken();
  if (!sessionToken) {
    return { data: null, error: { message: 'Sign in again to save consultation notes.' } };
  }

  if (!isR2StorageConfigured()) {
    return {
      data: null,
      error: {
        message:
          'File storage is not configured. Set VITE_R2_API_URL so consultation PDFs can be saved.'
      }
    };
  }

  let doctor = doctorProfile ?? null;
  if (!doctor && request.doctor_id) {
    const doctorResult = await fetchDoctorById(request.doctor_id);
    doctor = doctorResult.data ?? null;
  }

  const summaryForPdf: ConsultationSummary = {
    id: '',
    request_id: requestId,
    pdf_storage_path: null,
    created_at: '',
    updated_at: '',
    ...input
  };

  const blob = await generateConsultationSummaryPdfBlob(
    summaryForPdf,
    consultationSummaryPdfMetaFromRequest(request, doctor)
  );
  const file = new File([blob], `consultation-summary-${requestId}.pdf`, {
    type: 'application/pdf'
  });

  const { data: uploadTarget, error: presignError } = await createConsultationSummaryUploadUrl(
    requestId,
    file.size
  );
  if (presignError || !uploadTarget) {
    return {
      data: null,
      error: {
        message: normalizeStorageAuthError(
          presignError?.message ?? 'Could not prepare PDF upload.'
        )
      }
    };
  }

  const { error: uploadError } = await uploadFileToR2(
    uploadTarget.uploadUrl,
    file,
    'application/pdf',
    uploadTarget.storagePath
  );
  if (uploadError) {
    return {
      data: null,
      error: { message: normalizeStorageAuthError(uploadError.message) }
    };
  }

  const now = new Date().toISOString();
  const summaryPayload = {
    request_id: requestId,
    doctor_id: input.doctor_id,
    patient_auth_user_id: input.patient_auth_user_id,
    chief_complaint: input.chief_complaint,
    history_present_illness: input.history_present_illness,
    vital_signs: input.vital_signs,
    current_medications: input.current_medications,
    labs_diagnostics: input.labs_diagnostics,
    assessment_plan: input.assessment_plan,
    prescription: input.prescription,
    pdf_storage_path: uploadTarget.storagePath,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('consultation_summaries')
    .upsert(summaryPayload, { onConflict: 'request_id' })
    .select(CONSULTATION_SUMMARY_SELECT)
    .single<ConsultationSummary>();

  if (error) {
    const hint =
      error.message?.includes('pdf_storage_path') || error.code === '42703'
        ? ' Run supabase/migrations/027_consultation_summary_pdf.sql in the Supabase SQL Editor.'
        : '';
    return { data: null, error: { message: normalizeStorageAuthError(`${error.message}${hint}`) } };
  }

  const finalize = await finalizeDoctorConsultationRequest(requestId, request, trimmedResponse);
  if (finalize.error) {
    return {
      data: null,
      error: { message: normalizeStorageAuthError(finalize.error.message) }
    };
  }
  return { data, error: null };
}

const CONSULTATION_NOTES_PDF_MAX_BYTES = 10 * 1024 * 1024;

export function consultationNotesPdfValidationError(file: File): string | null {
  if (file.size < 1 || file.size > CONSULTATION_NOTES_PDF_MAX_BYTES) {
    return 'Consultation notes PDF must be between 1 byte and 10 MB.';
  }
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  if (!isPdf) return 'Upload a PDF file for consultation notes.';
  return null;
}

async function finalizeDoctorConsultationRequest(
  requestId: string,
  request: OpinionRequest,
  responseText: string
) {
  const trimmedResponse = responseText.trim();
  const now = new Date().toISOString();
  const requestUpdate: {
    doctor_response: string;
    responded_at: string;
    consultation_stage?: ConsultationStage;
    status?: OpinionRequestStatus;
  } = {
    doctor_response: trimmedResponse,
    responded_at: now
  };

  if (shouldCloseRequestAfterConsultation(request)) {
    requestUpdate.consultation_stage = 'completed';
    requestUpdate.status = 'closed';
  }

  const { error: requestError } = await supabase
    .from('opinion_requests')
    .update(requestUpdate)
    .eq('id', requestId);

  if (requestError) return { error: requestError };
  await logRequestAudit(requestId, 'consultation_summary_saved', 'doctor', {
    metadata: { consultation_completed: shouldCloseRequestAfterConsultation(request) }
  });
  return { error: null };
}

/** Doctor uploads a consultation notes PDF (no structured form). */
export async function saveDoctorConsultationUpload(
  requestId: string,
  request: OpinionRequest,
  file: File,
  optionalNote?: string,
  doctorProfile?: Doctor | null
) {
  const validationError = consultationNotesPdfValidationError(file);
  if (validationError) {
    return { data: null, error: { message: validationError } };
  }

  const sessionToken = await ensureFreshAccessToken();
  if (!sessionToken) {
    return { data: null, error: { message: 'Sign in again to upload consultation notes.' } };
  }

  if (!isR2StorageConfigured()) {
    return {
      data: null,
      error: {
        message:
          'File storage is not configured. Set VITE_R2_API_URL so consultation PDFs can be saved.'
      }
    };
  }

  const doctorId = doctorProfile?.id ?? request.doctor_id;
  const patientId = request.patient_id;
  if (!doctorId || !patientId) {
    return { data: null, error: { message: 'This request is missing doctor or patient information.' } };
  }

  const { data: uploadTarget, error: presignError } = await createConsultationSummaryUploadUrl(
    requestId,
    file.size
  );
  if (presignError || !uploadTarget) {
    return {
      data: null,
      error: {
        message: normalizeStorageAuthError(
          presignError?.message ?? 'Could not prepare PDF upload.'
        )
      }
    };
  }

  const { error: uploadError } = await uploadFileToR2(
    uploadTarget.uploadUrl,
    file,
    'application/pdf',
    uploadTarget.storagePath
  );
  if (uploadError) {
    return {
      data: null,
      error: { message: normalizeStorageAuthError(uploadError.message) }
    };
  }

  const note = optionalNote?.trim();
  const responseText =
    note || 'Consultation notes uploaded. See the attached PDF for the full clinical summary.';
  const now = new Date().toISOString();
  const summaryPayload = {
    request_id: requestId,
    doctor_id: doctorId,
    patient_auth_user_id: patientId,
    chief_complaint: note || null,
    history_present_illness: null,
    vital_signs: null,
    current_medications: null,
    labs_diagnostics: null,
    assessment_plan: null,
    prescription: null,
    pdf_storage_path: uploadTarget.storagePath,
    updated_at: now
  };

  const { data, error } = await supabase
    .from('consultation_summaries')
    .upsert(summaryPayload, { onConflict: 'request_id' })
    .select(CONSULTATION_SUMMARY_SELECT)
    .single<ConsultationSummary>();

  if (error) {
    const hint =
      error.message?.includes('pdf_storage_path') || error.code === '42703'
        ? ' Run supabase/migrations/027_consultation_summary_pdf.sql in the Supabase SQL Editor.'
        : '';
    return { data: null, error: { message: normalizeStorageAuthError(`${error.message}${hint}`) } };
  }

  const finalize = await finalizeDoctorConsultationRequest(requestId, request, responseText);
  if (finalize.error) {
    return {
      data: null,
      error: { message: normalizeStorageAuthError(finalize.error.message) }
    };
  }
  return { data, error: null };
}

/** @deprecated Use saveDoctorConsultation — kept for any legacy callers. */
export async function doctorSubmitConsultationSummary(
  requestId: string,
  input: Omit<ConsultationSummary, 'id' | 'request_id' | 'created_at' | 'updated_at' | 'pdf_storage_path'>,
  request: OpinionRequest,
  responseText: string
) {
  return saveDoctorConsultation(requestId, request, input, responseText);
}

/** Administrator assigns a submitted request to a Patient Service Executive. */
export async function assignOpinionRequest(requestId: string, assigneeAdminId: string) {
  const assignedAt = new Date().toISOString();
  const payload = {
    assigned_to: assigneeAdminId,
    assigned_at: assignedAt,
    consultation_stage: 'assigned' as const
  };

  let { data, error } = await supabase
    .from('opinion_requests')
    .update(payload)
    .eq('id', requestId)
    .select('id, assigned_to, assigned_at, consultation_stage')
    .single();

  if (error && isMissingWorkflowColumnsError(error)) {
    const legacy = await supabase
      .from('opinion_requests')
      .update({
        assigned_to: assigneeAdminId,
        assigned_at: assignedAt
      })
      .eq('id', requestId)
      .select('id, assigned_to, assigned_at')
      .single();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    const hint =
      error.code === '42501' || error.message?.toLowerCase().includes('permission')
        ? ' Run supabase/migrations/017_staff_roles_request_assignment.sql in the Supabase SQL Editor.'
        : '';
    return { data: null, error: { message: `${error.message}${hint}` } };
  }

  await logRequestAudit(requestId, 'request_assigned', 'administrator', {
    metadata: { assigned_to: assigneeAdminId }
  });
  return { data, error: null };
}

/** Patient Service Executive forwards a coordinated request to the doctor. */
export async function forwardOpinionRequestToDoctor(requestId: string, coordinationNotes?: string) {
  const update: {
    status: 'in_review';
    coordination_notes?: string;
  } = { status: 'in_review' };

  const trimmedNotes = coordinationNotes?.trim();
  if (trimmedNotes) {
    update.coordination_notes = trimmedNotes;
  }

  const { data, error } = await supabase
    .from('opinion_requests')
    .update(update)
    .eq('id', requestId)
    .eq('status', 'submitted')
    .select('id, status, coordination_notes')
    .single();

  if (error) {
    const hint =
      error.code === '42501' || error.message?.toLowerCase().includes('permission')
        ? ' Run supabase/migrations/017_staff_roles_request_assignment.sql in the Supabase SQL Editor.'
        : '';
    return { data: null, error: { message: `${error.message}${hint}` } };
  }

  await logRequestAudit(requestId, 'request_forwarded_to_doctor', 'pse');
  return { data, error: null };
}

const PAYMENT_WORKFLOW_REALTIME_FIELDS = new Set([
  'payment_link',
  'payment_status',
  'payment_amount',
  'payment_currency',
  'consultation_stage',
  'invoice_pdf_storage_path',
  'invoice_generated_at',
  'invoice_number',
  'invoice_subtotal',
  'invoice_tax_rate',
  'invoice_tax_amount',
  'invoice_total'
]);

const CASE_DETAILS_REALTIME_FIELDS = new Set([
  'patient_case_details',
  'case_details_reviewed_at',
  'message',
  'requested_specialty'
]);

function isPaymentWorkflowRealtimePayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const row = (payload as { new?: Record<string, unknown> | null }).new;
  if (!row) return false;
  return Object.keys(row).some((key) => PAYMENT_WORKFLOW_REALTIME_FIELDS.has(key));
}

function isCaseDetailsRealtimePayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const row = (payload as { new?: Record<string, unknown> | null }).new;
  if (!row) return false;
  return Object.keys(row).some((key) => CASE_DETAILS_REALTIME_FIELDS.has(key));
}

function opinionRequestLiveChannelName(requestId: string) {
  return `opinion-request-live:${requestId}`;
}

export type OpinionRequestLiveCaseDetailsHint = {
  type: 'case_details';
  patient_case_details?: unknown | null;
  message?: string | null;
  requested_specialty?: string | null;
};

export type SavedPatientCaseDetailsPatch = {
  patient_case_details: unknown;
  message?: string | null;
  requested_specialty?: string | null;
};

/** Push an immediate refresh to open request detail views (PSE + patient). */
export function notifyOpinionRequestLiveChange(
  requestId: string,
  event: 'case_details_updated' | 'request_refresh' = 'request_refresh',
  payload?: Record<string, unknown>
) {
  const channel = supabase.channel(opinionRequestLiveChannelName(requestId), {
    config: { broadcast: { ack: false } }
  });
  void channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    void channel.send({
      type: 'broadcast',
      event,
      payload: { requestId, at: Date.now(), ...payload }
    });
    window.setTimeout(() => {
      void supabase.removeChannel(channel);
    }, 1000);
  });
}

function createDebouncedLiveRefresh(onChange: () => void, debounceMs: number) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let followUpTimer: ReturnType<typeof setTimeout> | null = null;

  const refresh = () => {
    onChange();
  };

  const scheduleRefresh = (payload?: unknown, options?: { immediate?: boolean }) => {
    const immediate =
      options?.immediate ||
      isPaymentWorkflowRealtimePayload(payload) ||
      isCaseDetailsRealtimePayload(payload);

    if (immediate) {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (followUpTimer) clearTimeout(followUpTimer);
      refresh();
      followUpTimer = setTimeout(refresh, debounceMs);
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, debounceMs);
  };

  const cancel = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (followUpTimer) clearTimeout(followUpTimer);
    debounceTimer = null;
    followUpTimer = null;
  };

  return { scheduleRefresh, cancel };
}

type OpinionRequestLiveSubscriber = {
  scheduleRefresh: (payload?: unknown, options?: { immediate?: boolean }) => void;
  applyCaseDetailsHint: (payload: Record<string, unknown> | undefined) => void;
  cancel: () => void;
};

const opinionRequestLiveSubscribers = new Map<string, Set<OpinionRequestLiveSubscriber>>();
const opinionRequestLiveChannels = new Map<string, ReturnType<typeof supabase.channel>>();

function notifyOpinionRequestLiveSubscribers(
  requestId: string,
  invoke: (subscriber: OpinionRequestLiveSubscriber) => void
) {
  const subscribers = opinionRequestLiveSubscribers.get(requestId);
  if (!subscribers) return;
  for (const subscriber of subscribers) {
    invoke(subscriber);
  }
}

function ensureOpinionRequestLiveChannel(requestId: string) {
  if (opinionRequestLiveChannels.has(requestId)) return;

  const channel = supabase
    .channel(opinionRequestLiveChannelName(requestId), {
      config: { broadcast: { ack: false } }
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'opinion_requests',
        filter: `id=eq.${requestId}`
      },
      (payload) => {
        const row = (payload as { new?: Record<string, unknown> | null }).new;
        if (row && isCaseDetailsRealtimePayload(payload)) {
          notifyOpinionRequestLiveSubscribers(requestId, (subscriber) => {
            subscriber.applyCaseDetailsHint(row);
          });
        }
        notifyOpinionRequestLiveSubscribers(requestId, (subscriber) => {
          subscriber.scheduleRefresh(payload);
        });
      }
    )
    .on('broadcast', { event: 'case_details_updated' }, ({ payload }) => {
      notifyOpinionRequestLiveSubscribers(requestId, (subscriber) => {
        subscriber.applyCaseDetailsHint(payload as Record<string, unknown> | undefined);
        subscriber.scheduleRefresh(undefined, { immediate: true });
      });
    })
    .on('broadcast', { event: 'request_refresh' }, () => {
      notifyOpinionRequestLiveSubscribers(requestId, (subscriber) => {
        subscriber.scheduleRefresh(undefined, { immediate: true });
      });
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'opinion_request_recommendations',
        filter: `request_id=eq.${requestId}`
      },
      () => {
        notifyOpinionRequestLiveSubscribers(requestId, (subscriber) => {
          subscriber.scheduleRefresh();
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'consultation_summaries',
        filter: `request_id=eq.${requestId}`
      },
      () => {
        notifyOpinionRequestLiveSubscribers(requestId, (subscriber) => {
          subscriber.scheduleRefresh();
        });
      }
    )
    .subscribe();

  opinionRequestLiveChannels.set(requestId, channel);
}

function teardownOpinionRequestLiveChannel(requestId: string) {
  const channel = opinionRequestLiveChannels.get(requestId);
  if (!channel) return;
  void supabase.removeChannel(channel);
  opinionRequestLiveChannels.delete(requestId);
}

/** Live updates for a single request detail view (recommendations, stage, summary). */
export function subscribeOpinionRequestLiveUpdates(
  requestId: string,
  onChange: (hint?: OpinionRequestLiveCaseDetailsHint) => void
): () => void {
  const { scheduleRefresh, cancel } = createDebouncedLiveRefresh(() => onChange(), 400);

  const applyCaseDetailsHint = (payload: Record<string, unknown> | undefined) => {
    onChange({
      type: 'case_details',
      patient_case_details: payload?.patient_case_details ?? null,
      message: typeof payload?.message === 'string' ? payload.message : null,
      requested_specialty:
        typeof payload?.requested_specialty === 'string' ? payload.requested_specialty : null
    });
  };

  let subscribers = opinionRequestLiveSubscribers.get(requestId);
  if (!subscribers) {
    subscribers = new Set();
    opinionRequestLiveSubscribers.set(requestId, subscribers);
  }

  const subscriber: OpinionRequestLiveSubscriber = {
    scheduleRefresh,
    applyCaseDetailsHint,
    cancel
  };
  subscribers.add(subscriber);
  ensureOpinionRequestLiveChannel(requestId);

  return () => {
    cancel();
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      opinionRequestLiveSubscribers.delete(requestId);
      teardownOpinionRequestLiveChannel(requestId);
    }
  };
}

/** Push updates from Supabase Realtime when PSE/staff change a patient's requests (replaces polling). */
export function subscribePatientOpinionRequestUpdates(
  patientAuthUserId: string,
  onChange: () => void
): () => void {
  const { scheduleRefresh, cancel } = createDebouncedLiveRefresh(onChange, 500);

  const channel = supabase
    .channel(`patient-opinion-requests:${patientAuthUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'opinion_requests',
        filter: `patient_id=eq.${patientAuthUserId}`
      },
      (payload) => scheduleRefresh(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'opinion_request_recommendations' },
      scheduleRefresh
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'consultation_summaries',
        filter: `patient_auth_user_id=eq.${patientAuthUserId}`
      },
      scheduleRefresh
    )
    .subscribe();

  return () => {
    cancel();
    void supabase.removeChannel(channel);
  };
}

/** Realtime updates for PSE/admin request queues (patient doctor selection, stage changes, etc.). */
export function subscribeStaffOpinionRequestUpdates(
  onChange: () => void,
  options?: { assignedToAdminId?: string | null }
): () => void {
  const { scheduleRefresh, cancel } = createDebouncedLiveRefresh(onChange, 400);

  const assigneeId = options?.assignedToAdminId?.trim() || null;
  const channelName = assigneeId
    ? `staff-opinion-requests:${assigneeId}`
    : 'staff-opinion-requests:all';

  const matchesAssignee = (
    payload: { new?: { assigned_to?: string | null } | null; old?: { assigned_to?: string | null } | null }
  ) => {
    if (!assigneeId) return true;
    const row = payload.new ?? payload.old;
    if (!row) return true;
    if (row.assigned_to === assigneeId) return true;
    // Partial UPDATE payloads may omit assigned_to — still refresh assigned PSE queues.
    if (row.assigned_to === undefined) return true;
    return false;
  };

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'opinion_requests' },
      (payload) => {
        if (matchesAssignee(payload)) scheduleRefresh(payload);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'opinion_request_recommendations' },
      () => scheduleRefresh()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'consultation_summaries' },
      () => scheduleRefresh()
    )
    .subscribe();

  return () => {
    cancel();
    void supabase.removeChannel(channel);
  };
}

/** Realtime updates for a doctor's assigned request queue and open case detail views. */
export function subscribeDoctorOpinionRequestUpdates(
  onChange: () => void,
  options?: { doctorId?: string | null }
): () => void {
  const { scheduleRefresh, cancel } = createDebouncedLiveRefresh(onChange, 400);
  const doctorId = options?.doctorId?.trim() || null;
  const channelName = doctorId ? `doctor-opinion-requests:${doctorId}` : 'doctor-opinion-requests';

  const requestChangeConfig = doctorId
    ? {
        event: '*' as const,
        schema: 'public',
        table: 'opinion_requests',
        filter: `doctor_id=eq.${doctorId}`
      }
    : {
        event: '*' as const,
        schema: 'public',
        table: 'opinion_requests'
      };

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', requestChangeConfig, (payload) => scheduleRefresh(payload))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'opinion_request_records' },
      () => scheduleRefresh(undefined, { immediate: true })
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'consultation_summaries' },
      () => scheduleRefresh()
    )
    .subscribe();

  return () => {
    cancel();
    void supabase.removeChannel(channel);
  };
}
