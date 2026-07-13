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
