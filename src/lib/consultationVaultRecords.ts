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
import {
  createConsultationOrderUploadUrl,
  registerConsultationOrderVaultRecord,
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
    patientId: request.patient_id,
    doctorName: doctor?.full_name ?? request.doctor_name,
    doctorSpecialty: doctor?.specialty ?? request.doctor_specialty,
    scheduledAt: request.scheduled_at,
    requestId: request.id,
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

/** Save prescription / lab order PDFs into the patient's records vault under the correct category. */
export async function syncConsultationOrdersToPatientVault(
  input: SyncConsultationOrdersInput
): Promise<{ error: { message: string } | null }> {
  const { request, prescription, labsDiagnostics } = input;
  if (!request.patient_id?.trim()) {
    return { error: { message: 'This request is missing patient information.' } };
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
