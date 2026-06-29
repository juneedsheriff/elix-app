import { ELIX_BRAND, loadElixLogoDataUrl } from './pdfBranding';

export type ConsultationOrderPdfMeta = {
  patientName?: string | null;
  patientId?: string | null;
  doctorName?: string | null;
  doctorSpecialty?: string | null;
  scheduledAt?: string | null;
  requestId?: string | null;
  issuedAt?: Date;
};

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
    writeRight(`Request ID: ${shortId(meta.requestId)}`, 9);
  }
  if (meta.scheduledAt) {
    writeRight(`Consultation: ${new Date(meta.scheduledAt).toLocaleString()}`, 9);
  }

  y = Math.max(y, rightY) + 12;

  addLine('Patient', 11, true);
  if (meta.patientName) addLine(meta.patientName, 11);
  if (meta.patientId) addLine(`Patient ID: ${shortId(meta.patientId)}`, 10);
  y += 8;

  addLine('Consultation provider', 11, true);
  if (meta.doctorName) {
    addLine(
      `${meta.doctorName}${meta.doctorSpecialty ? ` · ${meta.doctorSpecialty}` : ''}`,
      11
    );
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
  const doc = await buildOrderPdf('PRESCRIPTION', prescriptionText, meta);
  return doc.output('blob');
}

export async function generateLabOrderPdfBlob(
  labOrderText: string,
  meta: ConsultationOrderPdfMeta
): Promise<Blob> {
  const doc = await buildOrderPdf('LAB ORDER', labOrderText, meta);
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
