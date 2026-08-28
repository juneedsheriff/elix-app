import type { MedicalRecordCategoryId } from './medicalRecordCategories';
import { medicalRecordCategoryLabel } from './medicalRecordCategories';
import {
  buildOrderDownloadFilename,
  generateLabOrderPdfBlob,
  generatePrescriptionOrderPdfBlob,
  type ConsultationOrderPdfMeta
} from './consultationOrdersPdf';
import type { OpinionRequest } from '../types/opinionRequest';
import type { Doctor } from '../types/doctor';
import type { MedicalRecord } from '../types/uploadedFile';
import { supabase } from './supabase';
import {
  createConsultationOrderUploadUrl,
  registerConsultationOrderVaultRecord,
  registerRequestRecord,
  uploadFileToR2
} from './r2Storage';

type SyncConsultationOrdersInput = {
  request: OpinionRequest;
  doctor?: Doctor | null;
  prescription?: string | null;
  labsDiagnostics?: string | null;
  issuedAt: Date;
};

function orderPdfMeta(input: SyncConsultationOrdersInput): ConsultationOrderPdfMeta {
  const { request, doctor, issuedAt } = input;
  return {
    patientName: request.patient_name,
    patientGender: request.patient_gender,
    patientEmail: request.patient_email,
    patientId: request.patient_id,
    doctorName: doctor?.full_name ?? request.doctor_name,
    doctorSpecialty: doctor?.specialty ?? request.doctor_specialty,
    doctorQualification: doctor?.qualification ?? null,
    doctorMedicalLicenseNo: doctor?.medical_license_no ?? null,
    doctor: doctor ?? null,
    scheduledAt: request.scheduled_at,
    requestId: request.id,
    clinicId: request.clinic_id,
    clinicName: request.clinic_name,
    issuedAt
  };
}

async function storeConsultationOrderPdf(
  requestId: string,
  type: 'prescription' | 'lab',
  text: string,
  meta: ConsultationOrderPdfMeta
): Promise<{ error: { message: string } | null }> {
  const recordCategory: MedicalRecordCategoryId =
    type === 'prescription' ? 'prescriptions' : 'lab_results';
  const fileName = buildOrderDownloadFilename(type, meta);
  const blob =
    type === 'prescription'
      ? await generatePrescriptionOrderPdfBlob(text, meta)
      : await generateLabOrderPdfBlob(text, meta);
  const file = new File([blob], fileName, { type: 'application/pdf' });

  const { data: uploadTarget, error: presignError } = await createConsultationOrderUploadUrl(
    requestId,
    file.size,
    fileName,
    recordCategory
  );
  if (presignError || !uploadTarget) {
    return {
      error: {
        message: presignError?.message ?? 'Could not prepare consultation order upload.'
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
    return { error: uploadError };
  }

  const { error: registerError } = await registerConsultationOrderVaultRecord({
    requestId,
    storagePath: uploadTarget.storagePath,
    fileName,
    mimeType: 'application/pdf',
    fileSizeBytes: file.size,
    recordCategory,
    summary: medicalRecordCategoryLabel(recordCategory)
  });
  if (registerError) {
    return { error: registerError };
  }

  return { error: null };
}

/** Register the doctor consultation summary PDF in the patient's vault (Doctor's Notes). */
export async function syncConsultationSummaryToPatientVault(input: {
  request: OpinionRequest;
  storagePath: string;
  fileName?: string | null;
  fileSizeBytes?: number | null;
}): Promise<{ error: { message: string } | null }> {
  const storagePath = input.storagePath?.trim();
  if (!storagePath) return { error: null };
  if (!input.request.patient_id?.trim()) return { error: null };

  const fileName =
    input.fileName?.trim() || `consultation-summary-${input.request.id.slice(0, 8)}.pdf`;
  const { error } = await registerRequestRecord({
    requestId: input.request.id,
    storagePath,
    fileName,
    mimeType: 'application/pdf',
    fileSizeBytes: input.fileSizeBytes && input.fileSizeBytes > 0 ? input.fileSizeBytes : 1,
    recordCategory: 'consultation_summary',
    summary: medicalRecordCategoryLabel('consultation_summary')
  });

  if (error) {
    return { error: { message: error.message } };
  }
  return { error: null };
}

/** Save prescription / lab order PDFs into the patient's records vault under the correct category. */
export async function syncConsultationOrdersToPatientVault(
  input: SyncConsultationOrdersInput
): Promise<{ error: { message: string } | null }> {
  const { request, prescription, labsDiagnostics } = input;
  // Clinic patients may not have claimed a login yet — skip vault sync until patient_id exists.
  if (!request.patient_id?.trim()) {
    return { error: null };
  }

  const meta = orderPdfMeta(input);
  const prescriptionText = prescription?.trim() ?? '';
  const labText = labsDiagnostics?.trim() ?? '';

  if (prescriptionText) {
    const result = await storeConsultationOrderPdf(request.id, 'prescription', prescriptionText, meta);
    if (result.error) return result;
  }

  if (labText) {
    const result = await storeConsultationOrderPdf(request.id, 'lab', labText, meta);
    if (result.error) return result;
  }

  return { error: null };
}

const CONSULTATION_SUMMARY_RECORD_PREFIX = 'consultation-summary:';

function nestedDoctorName(
  doctor: { full_name?: string | null } | { full_name?: string | null }[] | null | undefined,
  fallback?: string | null
): string | null {
  const row = Array.isArray(doctor) ? doctor[0] : doctor;
  return row?.full_name?.trim() || fallback?.trim() || null;
}

function consultationRequestIdFromPath(storagePath: string | null | undefined): string | null {
  const path = storagePath?.trim() ?? '';
  return (
    path.match(/^consultation-summaries\/([^/]+)\//)?.[1] ??
    path.match(/\/request-records\/([^/]+)\//)?.[1] ??
    null
  );
}

function consultationSummaryFileName(storagePath: string, doctorName: string | null): string {
  const base = storagePath.split('/').pop()?.trim() || 'consultation-summary.pdf';
  if (!doctorName) return base;
  const ext = base.includes('.') ? `.${base.split('.').pop()}` : '.pdf';
  return `Consultation summary — ${doctorName}${ext}`;
}

type ConsultationSummaryVaultRow = {
  id: string;
  request_id?: string | null;
  pdf_storage_path?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  doctor?: { full_name: string | null } | { full_name: string | null }[] | null;
  request?: { doctor_name: string | null } | { doctor_name: string | null }[] | null;
};

function consultationSummaryToVaultRecord(
  row: ConsultationSummaryVaultRow,
  patientAuthUserId: string,
  fallbackDoctorName?: string | null
): MedicalRecord | null {
  const storagePath = row.pdf_storage_path?.trim();
  if (!storagePath) return null;
  const request = Array.isArray(row.request) ? row.request[0] : row.request;
  const doctorName = nestedDoctorName(row.doctor, request?.doctor_name ?? fallbackDoctorName);
  const uploadedAt = row.updated_at?.trim() || row.created_at?.trim() || new Date().toISOString();
  return {
    id: `${CONSULTATION_SUMMARY_RECORD_PREFIX}${row.id}`,
    user_id: patientAuthUserId,
    patient_id: patientAuthUserId,
    file_name: consultationSummaryFileName(storagePath, doctorName),
    mime_type: 'application/pdf',
    file_size_bytes: 1,
    storage_bucket: 'medical-records',
    storage_path: storagePath,
    summary: medicalRecordCategoryLabel('consultation_summary'),
    uploaded_at: uploadedAt,
    record_category: 'consultation_summary',
    external_url: null,
    file_type: 'application/pdf'
  };
}

/** All saved consultation summary PDFs for a patient (including visits not copied into uploaded_files). */
export async function fetchPatientConsultationSummaryVaultRecords(
  patientAuthUserId: string
): Promise<MedicalRecord[]> {
  const id = patientAuthUserId.trim();
  if (!id) return [];

  const bySummaryId = new Map<string, MedicalRecord>();

  const addRow = (
    row: ConsultationSummaryVaultRow | null | undefined,
    fallbackDoctorName?: string | null
  ) => {
    if (!row?.id || bySummaryId.has(row.id)) return;
    const record = consultationSummaryToVaultRecord(row, id, fallbackDoctorName);
    if (record) bySummaryId.set(row.id, record);
  };

  const [directRes, viaRequestRes] = await Promise.all([
    supabase
      .from('consultation_summaries')
      .select(
        'id, request_id, pdf_storage_path, created_at, updated_at, doctor:doctors(full_name), request:opinion_requests(doctor_name)'
      )
      .eq('patient_auth_user_id', id)
      .not('pdf_storage_path', 'is', null)
      .returns<ConsultationSummaryVaultRow[]>(),
    supabase
      .from('opinion_requests')
      .select(
        'id, doctor_name, consultation_summaries(id, request_id, pdf_storage_path, created_at, updated_at, doctor:doctors(full_name))'
      )
      .eq('patient_id', id)
  ]);

  for (const row of directRes.data ?? []) {
    addRow(row);
  }

  if (!viaRequestRes.error) {
    for (const request of viaRequestRes.data ?? []) {
      const nested = request.consultation_summaries as
        | ConsultationSummaryVaultRow
        | ConsultationSummaryVaultRow[]
        | null;
      const summaries = Array.isArray(nested) ? nested : nested ? [nested] : [];
      for (const summary of summaries) {
        addRow(summary, request.doctor_name);
      }
    }
  }

  return [...bySummaryId.values()];
}

export function mergeVaultRecordsWithConsultationSummaries(
  files: MedicalRecord[],
  summaries: MedicalRecord[]
): MedicalRecord[] {
  const coveredRequestIds = new Set<string>();
  const coveredPaths = new Set<string>();

  for (const file of files) {
    const path = file.storage_path?.trim();
    if (path) coveredPaths.add(path);
    const requestId = consultationRequestIdFromPath(path);
    if (
      requestId &&
      (file.record_category === 'consultation_summary' || path?.startsWith('consultation-summaries/'))
    ) {
      coveredRequestIds.add(requestId);
    }
  }

  const extras = summaries.filter((summary) => {
    const path = summary.storage_path?.trim();
    if (!path || coveredPaths.has(path)) return false;
    const requestId = consultationRequestIdFromPath(path);
    if (requestId && coveredRequestIds.has(requestId)) return false;
    return true;
  });

  return [...files, ...extras].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
}

export function isSyntheticConsultationSummaryRecord(record: { id?: string | null }): boolean {
  return Boolean(record.id?.startsWith(CONSULTATION_SUMMARY_RECORD_PREFIX));
}
