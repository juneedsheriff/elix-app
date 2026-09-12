import {
  ELIX_BRAND,
  loadElixLogoDataUrl,
  PDF_SIGNATURE_RESERVE_PT,
  resolvePdfClinicContext,
  writePdfDoctorSignatureBlock
} from './pdfBranding';
import { formatConsultationFollowupDate } from './consultationSummaryFields';
import { orderFileToPdfImageData } from './consultationOrdersPdf';
import type { Doctor } from '../types/doctor';
import type { ConsultationSummary } from '../types/opinionRequest';

export type ConsultationSummaryPdfMeta = {
  patientName?: string | null;
  patientGender?: string | null;
  patientEmail?: string | null;
  patientId?: string | null;
  doctor?: Doctor | null;
  doctorName?: string | null;
  doctorSpecialty?: string | null;
  scheduledAt?: string | null;
  requestId?: string | null;
  /** When set, request belongs to a PSE clinic workspace (not global PSE). */
  clinicId?: string | null;
  clinicName?: string | null;
  clinicAddressLines?: string[] | null;
  issuedAt?: Date;
};

export type ConsultationSummaryPdfAttachments = {
  prescriptionFile?: File | Blob | null;
  prescriptionFileName?: string | null;
  labOrderFile?: File | Blob | null;
  labOrderFileName?: string | null;
};

/** Clinical summary section order (matches doctor dashboard). */
const CLINICAL_SECTIONS: Array<{ key: keyof ConsultationSummary; label: string }> = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'history_present_illness', label: 'History of Present Illness' },
  { key: 'past_medical_history', label: 'Past Medical/Surgical/Social History' },
  { key: 'review_of_systems', label: 'Review of Systems (ROS)' },
  { key: 'vital_signs', label: 'Vital Signs' },
  { key: 'physical_examination', label: 'Physical Examination (PE)' },
  { key: 'assessment_plan', label: 'Assessment/Plan' },
  { key: 'prescription', label: 'Prescription' },
  { key: 'advise_food_lifestyle', label: 'Advise on Food/Lifestyle' },
  { key: 'refer_to', label: 'Refer To' },
  { key: 'followup_date', label: 'Follow-up Date' }
];

/** Full section list including lab order (shown after clinical block when present). */
const SECTIONS: Array<{ key: keyof ConsultationSummary; label: string }> = [
  ...CLINICAL_SECTIONS,
  { key: 'labs_diagnostics', label: 'Lab Order' }
];

function isUploadedFilePlaceholder(value: string): boolean {
  return /^\[uploaded file:\s*.+\]$/i.test(value.trim());
}

function uploadedFileNameFromPlaceholder(value: string): string | null {
  const match = value.trim().match(/^\[uploaded file:\s*(.+)\]$/i);
  return match?.[1]?.trim() || null;
}

function sectionDisplayValue(key: keyof ConsultationSummary, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (isUploadedFilePlaceholder(value)) return '';
  if (key === 'followup_date') {
    return formatConsultationFollowupDate(value);
  }
  return value.trim();
}

function wrapText(doc: { splitTextToSize: (text: string, maxWidth: number) => string[] }, text: string, maxWidth: number) {
  return doc.splitTextToSize(text, maxWidth);
}

function doctorDisplayName(meta: ConsultationSummaryPdfMeta): string | null {
  if (meta.doctor?.full_name?.trim()) return meta.doctor.full_name.trim();
  return meta.doctorName?.trim() ?? null;
}

function hasHonorificPrefix(name: string): boolean {
  return /^(dr|mr|mrs|ms|miss)\.?\s+/i.test(name.trim());
}

function withDoctorHonorific(name: string | null): string | null {
  if (!name) return null;
  if (hasHonorificPrefix(name)) return name;
  return `Dr. ${name}`;
}

function withPatientHonorific(name: string | null, gender?: string | null): string | null {
  if (!name) return null;
  if (hasHonorificPrefix(name)) return name;
  const normalized = (gender ?? '').trim().toLowerCase();
  if (normalized === 'male') return `Mr. ${name}`;
  if (normalized === 'female') return `Ms. ${name}`;
  return name;
}

function doctorSpecialty(meta: ConsultationSummaryPdfMeta): string | null {
  if (meta.doctor?.specialty?.trim()) return meta.doctor.specialty.trim();
  return meta.doctorSpecialty?.trim() ?? null;
}

function shortId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
}

async function buildConsultationSummaryPdf(
  summary: ConsultationSummary,
  meta: ConsultationSummaryPdfMeta,
  attachments?: ConsultationSummaryPdfAttachments
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const contentBottom = pageHeight - margin - PDF_SIGNATURE_RESERVE_PT;
  let y = margin;
  const issuedAt = meta.issuedAt ?? new Date();

  const ensureSpace = (height: number) => {
    if (y + height > contentBottom) {
      doc.addPage();
      y = margin;
    }
  };

  const addLine = (text: string, size: number, bold = false, x = margin, maxWidth = contentWidth) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = wrapText(doc, text, maxWidth);
    for (const line of lines) {
      ensureSpace(size * 1.5);
      doc.text(line, x, y);
      y += size * 1.35;
    }
  };

  const logo = await loadElixLogoDataUrl();
  const logoTop = y;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, y - 6, 96, 32);
      y += 30;
    } catch {
      addLine(ELIX_BRAND.legalName, 16, true);
    }
  } else {
    addLine(ELIX_BRAND.legalName, 16, true);
  }

  const clinicAddress = (meta.clinicAddressLines ?? [])
    .map((line) => line.trim())
    .filter(Boolean);
  if (clinicAddress.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    for (const line of clinicAddress) {
      const lines = wrapText(doc, line, contentWidth * 0.55);
      for (const wrapped of lines) {
        doc.text(wrapped, margin, y);
        y += 11;
      }
    }
    doc.setTextColor(0, 0, 0);
  }

  let rightY = logoTop + 8;
  const writeRight = (text: string, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, pageWidth - margin, rightY, { align: 'right' });
    rightY += size * 1.35;
  };
  writeRight(`Date & Time: ${issuedAt.toLocaleString()}`, 10);
  if (meta.requestId) {
    writeRight(`Request ID: ${meta.requestId.slice(0, 8).toUpperCase()}`, 9);
  }

  y = Math.max(y, rightY) + 10;

  doc.setDrawColor(220, 228, 236);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Consultation Summary', margin, y);
  y += 16;

  doc.setDrawColor(220, 228, 236);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  const patientName = withPatientHonorific(meta.patientName ?? null, meta.patientGender);
  const providerName = withDoctorHonorific(doctorDisplayName(meta));
  const specialty = doctorSpecialty(meta);

  addLine('Patient', 10, true);
  if (patientName) addLine(patientName, 11);
  if (meta.patientEmail?.trim()) addLine(meta.patientEmail.trim(), 9);
  if (meta.patientId) addLine(`Patient ID: ${shortId(meta.patientId)}`, 9);
  y += 6;

  addLine('Consultation provider', 10, true);
  if (providerName) {
    addLine(`${providerName}${specialty ? ` · ${specialty}` : ''}`, 11);
  }
  if (meta.doctor?.qualification?.trim()) addLine(meta.doctor.qualification.trim(), 9);
  if (meta.doctor?.medical_license_no?.trim()) {
    addLine(`Medical license: ${meta.doctor.medical_license_no.trim()}`, 9);
  }
  y += 10;

  doc.setDrawColor(220, 228, 236);
  ensureSpace(20);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  for (const { key, label } of CLINICAL_SECTIONS) {
    if (key === 'prescription') {
      const raw = summary.prescription?.trim() ?? '';
      const placeholderName =
        raw && isUploadedFilePlaceholder(raw) ? uploadedFileNameFromPlaceholder(raw) : null;
      const text = raw && !isUploadedFilePlaceholder(raw) ? raw : '';
      const fileName =
        summary.prescription_file_name?.trim() ||
        placeholderName ||
        (attachments?.prescriptionFile instanceof File ? attachments.prescriptionFile.name : null);
      if (!text && !fileName && !attachments?.prescriptionFile) continue;

      addLine(label, 11, true);
      if (text) addLine(text, 10);
      if (fileName && !text) addLine(`Uploaded file: ${fileName}`, 10);
      if (attachments?.prescriptionFile) {
        const imageData = await orderFileToPdfImageData(
          attachments.prescriptionFile,
          fileName
        );
        if (imageData) {
          const imageMaxWidth = contentWidth;
          const imageMaxHeight = 220;
          const scale = Math.min(
            imageMaxWidth / imageData.width,
            imageMaxHeight / imageData.height,
            1
          );
          const drawWidth = imageData.width * scale;
          const drawHeight = imageData.height * scale;
          ensureSpace(drawHeight + 8);
          doc.addImage(imageData.dataUrl, imageData.format, margin, y, drawWidth, drawHeight);
          y += drawHeight + 8;
        } else if (!text) {
          addLine('This file is also stored as a separate document.', 10);
        }
      }
      y += 8;
      continue;
    }

    const value = sectionDisplayValue(key, summary[key]);
    if (!value) continue;
    addLine(label, 11, true);
    addLine(value, 10);
    y += 8;
  }

  const labRaw = summary.labs_diagnostics?.trim() ?? '';
  const labPlaceholder =
    labRaw && isUploadedFilePlaceholder(labRaw) ? uploadedFileNameFromPlaceholder(labRaw) : null;
  const labText = labRaw && !isUploadedFilePlaceholder(labRaw) ? labRaw : '';
  const labFileName =
    attachments?.labOrderFileName?.trim() ||
    summary.lab_order_file_name?.trim() ||
    labPlaceholder ||
    (attachments?.labOrderFile instanceof File ? attachments.labOrderFile.name : null);
  if (labText || labFileName || attachments?.labOrderFile) {
    addLine('Lab Order', 11, true);
    if (labText) addLine(labText, 10);
    if (labFileName && !labText) addLine(`Uploaded file: ${labFileName}`, 10);
    if (attachments?.labOrderFile) {
      const imageData = await orderFileToPdfImageData(attachments.labOrderFile, labFileName);
      if (imageData) {
        const imageMaxWidth = contentWidth;
        const imageMaxHeight = 220;
        const scale = Math.min(
          imageMaxWidth / imageData.width,
          imageMaxHeight / imageData.height,
          1
        );
        const drawWidth = imageData.width * scale;
        const drawHeight = imageData.height * scale;
        ensureSpace(drawHeight + 8);
        doc.addImage(imageData.dataUrl, imageData.format, margin, y, drawWidth, drawHeight);
        y += drawHeight + 8;
      } else if (!labText) {
        addLine('This file is also stored as a separate document.', 10);
      }
    }
    y += 8;
  }

  ensureSpace(28);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This document was generated by ElixClinix for the patient consultation record.',
    margin,
    y,
    { maxWidth: contentWidth }
  );
  doc.setTextColor(0, 0, 0);
  y += 18;

  writePdfDoctorSignatureBlock(doc, {
    margin,
    pageWidth,
    pageHeight,
    doctorName: withDoctorHonorific(doctorDisplayName(meta)),
    y: Math.max(y + 12, pageHeight - margin - 58)
  });

  return doc;
}

export function consultationSummaryPdfMetaFromRequest(
  request: {
    id?: string;
    patient_id?: string | null;
    patient_name?: string | null;
    patient_gender?: string | null;
    patient_email?: string | null;
    doctor_name?: string | null;
    doctor_specialty?: string | null;
    scheduled_at?: string | null;
    clinic_id?: string | null;
    clinic_name?: string | null;
  },
  doctor?: Doctor | null
): ConsultationSummaryPdfMeta {
  return {
    patientId: request.patient_id,
    patientName: request.patient_name,
    patientGender: request.patient_gender,
    patientEmail: request.patient_email,
    doctor: doctor ?? null,
    doctorName: request.doctor_name,
    doctorSpecialty: request.doctor_specialty,
    scheduledAt: request.scheduled_at,
    requestId: request.id,
    clinicId: request.clinic_id ?? null,
    clinicName: request.clinic_name ?? null,
    issuedAt: new Date()
  };
}

/** Build consultation summary PDF bytes for upload or preview. */
export async function generateConsultationSummaryPdfBlob(
  summary: ConsultationSummary,
  meta: ConsultationSummaryPdfMeta,
  attachments?: ConsultationSummaryPdfAttachments
): Promise<Blob> {
  const clinic = await resolvePdfClinicContext({
    clinicId: meta.clinicId,
    clinicName: meta.clinicName,
    doctor: meta.doctor,
    patientId: meta.patientId
  });
  const doc = await buildConsultationSummaryPdf(
    summary,
    {
      ...meta,
      clinicId: clinic.clinicId,
      clinicName: clinic.clinicName,
      clinicAddressLines: clinic.clinicAddressLines
    },
    attachments
  );
  return doc.output('blob');
}

/** Build and download a consultation summary PDF (client-side fallback). */
export async function downloadConsultationSummaryPdf(
  summary: ConsultationSummary,
  meta: ConsultationSummaryPdfMeta,
  attachments?: ConsultationSummaryPdfAttachments
) {
  const blob = await generateConsultationSummaryPdfBlob(summary, meta, attachments);
  const safeName = (meta.patientName ?? 'patient').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `consultation-notes-${safeName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getConsultationSummarySections(summary: ConsultationSummary) {
  return SECTIONS.map(({ key, label }) => {
    const value = sectionDisplayValue(key, summary[key]);
    if (value) return { label, value };
    if (key === 'prescription' && summary.prescription_file_name?.trim()) {
      return { label, value: `Uploaded file: ${summary.prescription_file_name.trim()}` };
    }
    if (key === 'labs_diagnostics' && summary.lab_order_file_name?.trim()) {
      return { label, value: `Uploaded file: ${summary.lab_order_file_name.trim()}` };
    }
    return { label, value: '' };
  }).filter((section) => section.value);
}

/** All non-empty fields including prescription / lab order text. */
export function getConsultationAllSections(summary: ConsultationSummary) {
  return getConsultationSummarySections(summary);
}
