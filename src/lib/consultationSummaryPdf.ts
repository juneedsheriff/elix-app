import type { ConsultationSummary } from '../types/opinionRequest';

export type ConsultationSummaryPdfMeta = {
  patientName?: string | null;
  doctorName?: string | null;
  doctorSpecialty?: string | null;
  scheduledAt?: string | null;
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

async function buildConsultationSummaryPdf(
  summary: ConsultationSummary,
  meta: ConsultationSummaryPdfMeta
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addLine = (text: string, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = wrapText(doc, text, contentWidth);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += size * 1.35;
    }
  };

  addLine('Elix Health — Consultation Summary', 16, true);
  y += 6;
  if (meta.patientName) addLine(`Patient: ${meta.patientName}`, 11);
  if (meta.doctorName) {
    addLine(
      `Doctor: ${meta.doctorName}${meta.doctorSpecialty ? ` · ${meta.doctorSpecialty}` : ''}`,
      11
    );
  }
  if (meta.scheduledAt) {
    addLine(`Consultation: ${new Date(meta.scheduledAt).toLocaleString()}`, 11);
  }
  addLine(`Generated: ${new Date().toLocaleString()}`, 10);
  y += 10;

  for (const { key, label } of SECTIONS) {
    const value = summary[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    addLine(label, 12, true);
    addLine(value.trim(), 11);
    y += 8;
  }

  return doc;
}

export function consultationSummaryPdfMetaFromRequest(request: {
  patient_name?: string | null;
  doctor_name?: string | null;
  doctor_specialty?: string | null;
  scheduled_at?: string | null;
}): ConsultationSummaryPdfMeta {
  return {
    patientName: request.patient_name,
    doctorName: request.doctor_name,
    doctorSpecialty: request.doctor_specialty,
    scheduledAt: request.scheduled_at
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
  anchor.download = `consultation-summary-${safeName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getConsultationSummarySections(summary: ConsultationSummary) {
  return SECTIONS.map(({ key, label }) => ({
    label,
    value: typeof summary[key] === 'string' ? summary[key]?.trim() ?? '' : ''
  })).filter((section) => section.value);
}
