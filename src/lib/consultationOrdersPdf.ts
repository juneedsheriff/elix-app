import {
  ELIX_BRAND,
  loadElixLogoDataUrl,
  resolvePdfClinicContext,
  writePdfIssuerContactBlock
} from './pdfBranding';
import type { Doctor } from '../types/doctor';

export type ConsultationOrderPdfMeta = {
  patientName?: string | null;
  patientGender?: string | null;
  patientEmail?: string | null;
  patientId?: string | null;
  doctorName?: string | null;
  doctorSpecialty?: string | null;
  doctorQualification?: string | null;
  doctorMedicalLicenseNo?: string | null;
  doctor?: Doctor | null;
  scheduledAt?: string | null;
  requestId?: string | null;
  /** When set, request belongs to a PSE clinic workspace (not global PSE). */
  clinicId?: string | null;
  clinicName?: string | null;
  issuedAt?: Date;
};

function hasHonorificPrefix(name: string): boolean {
  return /^(dr|mr|mrs|ms|miss)\.?\s+/i.test(name.trim());
}

function withDoctorHonorific(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (hasHonorificPrefix(trimmed)) return trimmed;
  return `Dr. ${trimmed}`;
}

function withPatientHonorific(
  name: string | null | undefined,
  gender: string | null | undefined
): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (hasHonorificPrefix(trimmed)) return trimmed;
  const normalizedGender = (gender ?? '').trim().toLowerCase();
  if (normalizedGender === 'male') return `Mr. ${trimmed}`;
  if (normalizedGender === 'female') return `Ms. ${trimmed}`;
  return trimmed;
}

function shortId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
}

function safeFileName(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').slice(0, 40);
}

function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildOrderDownloadFilename(
  type: 'prescription' | 'lab',
  meta: ConsultationOrderPdfMeta
): string {
  const prefix = type === 'prescription' ? 'Prescription' : 'Lab-Order';
  const doctorPart = safeFileName(meta.doctorName?.trim() || 'Doctor');
  const issuedAt =
    meta.issuedAt ??
    (meta.scheduledAt ? new Date(meta.scheduledAt) : null) ??
    new Date();
  const datePart = formatDateForFilename(issuedAt);
  return `${prefix}-${doctorPart}-${datePart}.pdf`;
}

async function buildOrderPdf(
  title: 'PRESCRIPTION' | 'LAB ORDER',
  bodyText: string,
  meta: ConsultationOrderPdfMeta
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  const issuedAt = meta.issuedAt ?? new Date();

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addLine = (text: string, size: number, bold = false, x = margin, maxWidth = contentWidth) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      ensureSpace(size * 1.5);
      doc.text(line, x, y);
      y += size * 1.35;
    }
  };

  const logo = await loadElixLogoDataUrl();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, y - 6, 96, 32);
    } catch {
      addLine(ELIX_BRAND.legalName, 18, true);
    }
  } else {
    addLine(ELIX_BRAND.legalName, 18, true);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, pageWidth - margin, y + 8, { align: 'right' });
  y += 36;

  doc.setDrawColor(220, 228, 236);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  const leftColWidth = contentWidth * 0.52;
  writePdfIssuerContactBlock(addLine, {
    margin,
    leftColWidth,
    clinicId: meta.clinicId,
    clinicName: meta.clinicName,
    doctor: meta.doctor
  });

  let rightY = margin + 52;
  const writeRight = (text: string, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, pageWidth - margin, rightY, { align: 'right' });
    rightY += size * 1.35;
  };
  writeRight(
    `Date & Time: ${
      meta.scheduledAt
        ? new Date(meta.scheduledAt).toLocaleString()
        : issuedAt.toLocaleString()
    }`,
    10
  );
  if (meta.requestId) {
    writeRight(`Request ID: ${shortId(meta.requestId)}`, 9);
  }

  y = Math.max(y, rightY) + 12;

  addLine('Patient', 11, true);
  const patientDisplayName = withPatientHonorific(meta.patientName, meta.patientGender);
  if (patientDisplayName) addLine(patientDisplayName, 11);
  if (meta.patientEmail?.trim()) addLine(meta.patientEmail.trim(), 10);
  if (meta.patientId) addLine(`Patient ID: ${shortId(meta.patientId)}`, 10);
  y += 8;

  addLine('Consultation provider', 11, true);
  const doctorDisplayName = withDoctorHonorific(meta.doctor?.full_name ?? meta.doctorName);
  const specialty = meta.doctor?.specialty?.trim() || meta.doctorSpecialty?.trim() || null;
  if (doctorDisplayName) {
    addLine(`${doctorDisplayName}${specialty ? ` · ${specialty}` : ''}`, 11);
  }
  const qualification = meta.doctor?.qualification?.trim() || meta.doctorQualification?.trim();
  if (qualification) addLine(qualification, 10);
  const license =
    meta.doctor?.medical_license_no?.trim() || meta.doctorMedicalLicenseNo?.trim();
  if (license) {
    addLine(`License: ${license}`, 10);
  }
  y += 12;

  doc.setDrawColor(220, 228, 236);
  ensureSpace(20);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  addLine(title === 'PRESCRIPTION' ? 'Prescription details' : 'Lab order details', 13, true);
  y += 4;
  addLine(bodyText.trim(), 11);

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `This ${title.toLowerCase()} was generated from the consultation notes recorded by your doctor on ElixClinix.`,
    margin,
    y,
    { maxWidth: contentWidth }
  );
  doc.setTextColor(0, 0, 0);

  return doc;
}

export async function generatePrescriptionOrderPdfBlob(
  prescriptionText: string,
  meta: ConsultationOrderPdfMeta
): Promise<Blob> {
  const clinic = await resolvePdfClinicContext({
    clinicId: meta.clinicId,
    clinicName: meta.clinicName,
    doctor: meta.doctor,
    patientId: meta.patientId
  });
  const doc = await buildOrderPdf('PRESCRIPTION', prescriptionText, {
    ...meta,
    clinicId: clinic.clinicId,
    clinicName: clinic.clinicName
  });
  return doc.output('blob');
}

export async function generateLabOrderPdfBlob(
  labOrderText: string,
  meta: ConsultationOrderPdfMeta
): Promise<Blob> {
  const clinic = await resolvePdfClinicContext({
    clinicId: meta.clinicId,
    clinicName: meta.clinicName,
    doctor: meta.doctor,
    patientId: meta.patientId
  });
  const doc = await buildOrderPdf('LAB ORDER', labOrderText, {
    ...meta,
    clinicId: clinic.clinicId,
    clinicName: clinic.clinicName
  });
  return doc.output('blob');
}

export async function downloadPrescriptionOrderPdf(
  prescriptionText: string,
  meta: ConsultationOrderPdfMeta
) {
  const blob = await generatePrescriptionOrderPdfBlob(prescriptionText, meta);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildOrderDownloadFilename('prescription', meta);
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadLabOrderPdf(labOrderText: string, meta: ConsultationOrderPdfMeta) {
  const blob = await generateLabOrderPdfBlob(labOrderText, meta);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildOrderDownloadFilename('lab', meta);
  anchor.click();
  URL.revokeObjectURL(url);
}
