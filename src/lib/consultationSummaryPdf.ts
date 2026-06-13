import {
  ELIX_BRAND,
  formatDoctorClinicAddressLines,
  formatDoctorContactPhone,
  loadElixLogoDataUrl
} from './pdfBranding';
import type { Doctor } from '../types/doctor';
import type { ConsultationSummary } from '../types/opinionRequest';

export type ConsultationSummaryPdfMeta = {
  patientName?: string | null;
  patientEmail?: string | null;
  doctor?: Doctor | null;
  doctorName?: string | null;
  doctorSpecialty?: string | null;
  scheduledAt?: string | null;
  requestId?: string | null;
  issuedAt?: Date;
};

const SECTIONS: Array<{ key: keyof ConsultationSummary; label: string }> = [
  { key: 'chief_complaint', label: 'Chief complaint' },
  { key: 'history_present_illness', label: 'History of present illness' },
  { key: 'vital_signs', label: 'Vital signs' },
  { key: 'current_medications', label: 'Current medications' },
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

function doctorSpecialty(meta: ConsultationSummaryPdfMeta): string | null {
  if (meta.doctor?.specialty?.trim()) return meta.doctor.specialty.trim();
  return meta.doctorSpecialty?.trim() ?? null;
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
  addLine(ELIX_BRAND.legalName, 11, true, margin, leftColWidth);
  addLine(ELIX_BRAND.tagline, 10, false, margin, leftColWidth);
  addLine(ELIX_BRAND.email, 10, false, margin, leftColWidth);
  addLine(ELIX_BRAND.website, 10, false, margin, leftColWidth);

  let rightY = margin + 52;
  const writeRight = (text: string, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, pageWidth - margin, rightY, { align: 'right' });
    rightY += size * 1.35;
  };
  writeRight(`Date: ${issuedAt.toLocaleDateString()}`, 10);
  if (meta.requestId) {
    writeRight(`Request ID: ${meta.requestId.slice(0, 8).toUpperCase()}`, 9);
  }
  if (meta.scheduledAt) {
    writeRight(`Consultation: ${new Date(meta.scheduledAt).toLocaleString()}`, 9);
  }

  y = Math.max(y, rightY) + 12;

  addLine('Patient', 11, true);
  if (meta.patientName) addLine(meta.patientName, 11);
  if (meta.patientEmail) addLine(meta.patientEmail, 10);
  y += 8;

  addLine('Consultation provider', 11, true);
  const name = doctorDisplayName(meta);
  const specialty = doctorSpecialty(meta);
  if (name) {
    addLine(`${name}${specialty ? ` · ${specialty}` : ''}`, 11);
  }
  if (meta.doctor?.qualification?.trim()) addLine(meta.doctor.qualification.trim(), 10);
  if (meta.doctor?.medical_license_no?.trim()) {
    addLine(`Medical license: ${meta.doctor.medical_license_no.trim()}`, 10);
  }
  if (meta.doctor) {
    for (const line of formatDoctorClinicAddressLines(meta.doctor)) addLine(line, 10);
    const phone = formatDoctorContactPhone(meta.doctor);
    if (phone) addLine(`Phone: ${phone}`, 10);
    if (meta.doctor.clinic_website?.trim()) addLine(meta.doctor.clinic_website.trim(), 10);
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
    'This document was generated by Elix Health for the patient consultation record.',
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
    patient_name?: string | null;
    patient_email?: string | null;
    doctor_name?: string | null;
    doctor_specialty?: string | null;
    scheduled_at?: string | null;
  },
  doctor?: Doctor | null
): ConsultationSummaryPdfMeta {
  return {
    patientName: request.patient_name,
    patientEmail: request.patient_email,
    doctor: doctor ?? null,
    doctorName: request.doctor_name,
    doctorSpecialty: request.doctor_specialty,
    scheduledAt: request.scheduled_at,
    requestId: request.id,
    issuedAt: new Date()
  };
}

/** Build consultation summary PDF bytes for upload or preview. */
export async function generateConsultationSummaryPdfBlob(
  summary: ConsultationSummary,
  meta: ConsultationSummaryPdfMeta
): Promise<Blob> {
  const doc = await buildConsultationSummaryPdf(summary, meta);
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
