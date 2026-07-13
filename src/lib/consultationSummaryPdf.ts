import {
  ELIX_BRAND,
  loadElixLogoDataUrl,
  resolvePdfClinicContext,
  writePdfIssuerContactBlock
} from './pdfBranding';
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
  issuedAt?: Date;
};

const SECTIONS: Array<{ key: keyof ConsultationSummary; label: string }> = [
  { key: 'chief_complaint', label: 'Chief complaint' },
  { key: 'history_present_illness', label: 'History of present illness' },
  { key: 'past_medical_history', label: 'Past medical history' },
  { key: 'current_medications', label: 'Current medications' },
  { key: 'vital_signs', label: 'Vital signs' },
  { key: 'labs_diagnostics', label: 'Labs / diagnostics' },
  { key: 'assessment_plan', label: 'Assessment & plan' },
  { key: 'prescription', label: 'Prescription' }
];

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
  meta: ConsultationSummaryPdfMeta
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
    const lines = wrapText(doc, text, maxWidth);
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
  doc.text('CONSULTATION NOTES', pageWidth - margin, y + 8, { align: 'right' });
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
  writeRight(`Date & Time: ${issuedAt.toLocaleString()}`, 10);
  if (meta.requestId) {
    writeRight(`Request ID: ${meta.requestId.slice(0, 8).toUpperCase()}`, 9);
  }

  y = Math.max(y, rightY) + 12;

  addLine('Patient', 11, true);
  const patientName = withPatientHonorific(meta.patientName ?? null, meta.patientGender);
  if (patientName) addLine(patientName, 11);
  if (meta.patientEmail?.trim()) addLine(meta.patientEmail.trim(), 10);
  if (meta.patientId) addLine(`Patient ID: ${shortId(meta.patientId)}`, 10);
  y += 8;

  addLine('Consultation provider', 11, true);
  const name = withDoctorHonorific(doctorDisplayName(meta));
  const specialty = doctorSpecialty(meta);
  if (name) {
    addLine(`${name}${specialty ? ` · ${specialty}` : ''}`, 11);
  }
  if (meta.doctor?.qualification?.trim()) addLine(meta.doctor.qualification.trim(), 10);
  if (meta.doctor?.medical_license_no?.trim()) {
    addLine(`Medical license: ${meta.doctor.medical_license_no.trim()}`, 10);
  }
  y += 12;

  doc.setDrawColor(220, 228, 236);
  ensureSpace(20);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  addLine('Clinical summary', 13, true);
  y += 4;

  for (const { key, label } of SECTIONS) {
    const value = summary[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    addLine(label, 11, true);
    addLine(value.trim(), 10);
    y += 8;
  }

  ensureSpace(40);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This document was generated by ElixClinix for the patient consultation record.',
    margin,
    y,
    { maxWidth: contentWidth }
  );
  doc.setTextColor(0, 0, 0);

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
  meta: ConsultationSummaryPdfMeta
): Promise<Blob> {
  const clinic = await resolvePdfClinicContext({
    clinicId: meta.clinicId,
    clinicName: meta.clinicName,
    doctor: meta.doctor,
    patientId: meta.patientId
  });
  const doc = await buildConsultationSummaryPdf(summary, {
    ...meta,
    clinicId: clinic.clinicId,
    clinicName: clinic.clinicName
  });
  return doc.output('blob');
}

/** Build and download a consultation summary PDF (client-side fallback). */
export async function downloadConsultationSummaryPdf(
  summary: ConsultationSummary,
  meta: ConsultationSummaryPdfMeta
) {
  const blob = await generateConsultationSummaryPdfBlob(summary, meta);
  const safeName = (meta.patientName ?? 'patient').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `consultation-notes-${safeName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getConsultationSummarySections(summary: ConsultationSummary) {
  return SECTIONS.map(({ key, label }) => ({
    label,
    value: typeof summary[key] === 'string' ? summary[key]?.trim() ?? '' : ''
  })).filter((section) => section.value);
}
