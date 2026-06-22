import type { ConsultationCurrency } from '../types/doctor';
import type { Doctor } from '../types/doctor';
import {
  formatConsultationFeeForPdf,
  normalizeConsultationCurrency
} from './consultationCurrency';
import { formatDurationMinutesLabel } from './consultationTiers';
import { loadElixLogoDataUrl } from './pdfBranding';

export type ConsultationInvoiceTotals = {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  taxLabel: string | null;
};

export type ConsultationInvoicePdfInput = {
  invoiceNumber: string;
  issuedAt: Date;
  patientName: string | null;
  patientEmail: string | null;
  requestId: string;
  doctor: Doctor;
  durationMinutes: number | null;
  currency: ConsultationCurrency;
  totals: ConsultationInvoiceTotals;
};

const ELIX_BILLING = {
  legalName: 'ElixClinix',
  tagline: 'Doctor consultation & teleconsultation platform',
  email: 'support@elixhealth.com',
  website: 'www.elixhealth.com'
};

/** GST applies to INR consultation invoices; USD invoices have no tax by default. */
export function computeConsultationInvoiceTotals(
  subtotal: number,
  currency: ConsultationCurrency
): ConsultationInvoiceTotals {
  const amount = Math.max(0, Math.round(Number(subtotal) || 0));
  const taxRate = currency === 'INR' ? 0.18 : 0;
  const taxAmount = taxRate > 0 ? Math.round(amount * taxRate) : 0;
  return {
    subtotal: amount,
    taxRate,
    taxAmount,
    total: amount + taxAmount,
    taxLabel: taxRate > 0 ? `GST (${Math.round(taxRate * 100)}%)` : null
  };
}

export function buildConsultationInvoiceNumber(requestId: string, issuedAt = new Date()): string {
  const datePart = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
  const idPart = requestId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ELIX-INV-${datePart}-${idPart}`;
}

function formatClinicAddress(doctor: Doctor): string[] {
  const lines: string[] = [];
  const clinicName = doctor.clinic_name?.trim() || doctor.hospital?.trim();
  if (clinicName) lines.push(clinicName);
  const street = [doctor.clinic_street, doctor.clinic_location].filter(Boolean).join(', ');
  if (street) lines.push(street);
  const cityLine = [doctor.clinic_city, doctor.clinic_state, doctor.clinic_zipcode]
    .filter(Boolean)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  if (doctor.clinic_country?.trim()) lines.push(doctor.clinic_country.trim());
  return lines;
}

function wrapText(
  doc: { splitTextToSize: (text: string, maxWidth: number) => string[] },
  text: string,
  maxWidth: number
) {
  return doc.splitTextToSize(text, maxWidth);
}

async function buildConsultationInvoicePdf(input: ConsultationInvoicePdfInput) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

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
      addLine(ELIX_BILLING.legalName, 18, true);
    }
  } else {
    addLine(ELIX_BILLING.legalName, 18, true);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', pageWidth - margin, y + 8, { align: 'right' });
  y += 36;

  doc.setDrawColor(220, 228, 236);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  const leftColWidth = contentWidth * 0.52;
  const rightX = margin + leftColWidth + 16;

  addLine(ELIX_BILLING.legalName, 11, true, margin, leftColWidth);
  addLine(ELIX_BILLING.tagline, 10, false, margin, leftColWidth);
  addLine(ELIX_BILLING.email, 10, false, margin, leftColWidth);
  addLine(ELIX_BILLING.website, 10, false, margin, leftColWidth);

  const rightStartY = y - 4 * 11 * 1.35;
  let rightY = Math.max(margin + 52, rightStartY);
  const writeRight = (text: string, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, pageWidth - margin, rightY, { align: 'right' });
    rightY += size * 1.35;
  };
  writeRight(`Invoice #: ${input.invoiceNumber}`, 10, true);
  writeRight(`Date: ${input.issuedAt.toLocaleDateString()}`, 10);
  writeRight(`Request ID: ${input.requestId.slice(0, 8).toUpperCase()}`, 9);

  y = Math.max(y, rightY) + 12;

  addLine('Bill to', 11, true);
  if (input.patientName) addLine(input.patientName, 11);
  if (input.patientEmail) addLine(input.patientEmail, 10);
  y += 8;

  addLine('Consultation provider', 11, true);
  addLine(
    `${input.doctor.full_name}${input.doctor.specialty ? ` · ${input.doctor.specialty}` : ''}`,
    11
  );
  if (input.doctor.qualification?.trim()) addLine(input.doctor.qualification.trim(), 10);
  if (input.doctor.medical_license_no?.trim()) {
    addLine(`License: ${input.doctor.medical_license_no.trim()}`, 10);
  }
  const clinicLines = formatClinicAddress(input.doctor);
  for (const line of clinicLines) addLine(line, 10);
  const contactPhone = input.doctor.mobile_no?.trim() || input.doctor.phone?.trim();
  if (contactPhone) addLine(`Phone: ${contactPhone}`, 10);
  if (input.doctor.clinic_website?.trim()) addLine(input.doctor.clinic_website.trim(), 10);
  y += 10;

  const durationLabel = input.durationMinutes
    ? formatDurationMinutesLabel(input.durationMinutes)
    : 'Consultation';
  const description = `${durationLabel} online consultation — ${input.doctor.full_name}`;

  ensureSpace(120);
  doc.setFillColor(245, 248, 252);
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Description', margin + 8, y + 14);
  doc.text('Amount', pageWidth - margin - 8, y + 14, { align: 'right' });
  y += 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const descLines = wrapText(doc, description, contentWidth - 120);
  for (const line of descLines) {
    ensureSpace(14);
    doc.text(line, margin + 8, y);
    y += 12;
  }
  const amountLabel = formatConsultationFeeForPdf(input.totals.subtotal, input.currency);
  doc.text(amountLabel, pageWidth - margin - 8, y - 12, { align: 'right' });
  y += 16;

  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  const summaryX = pageWidth - margin - 180;
  const valueX = pageWidth - margin - 8;
  const addSummaryRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.text(label, summaryX, y);
    doc.text(value, valueX, y, { align: 'right' });
    y += 16;
  };

  addSummaryRow(
    'Consultation fee',
    formatConsultationFeeForPdf(input.totals.subtotal, input.currency)
  );
  if (input.totals.taxLabel && input.totals.taxAmount > 0) {
    addSummaryRow(
      input.totals.taxLabel,
      formatConsultationFeeForPdf(input.totals.taxAmount, input.currency)
    );
  } else {
    addSummaryRow('Tax', '—');
  }
  y += 4;
  doc.line(summaryX, y, pageWidth - margin, y);
  y += 14;
  addSummaryRow(
    'Total due',
    formatConsultationFeeForPdf(input.totals.total, input.currency),
    true
  );

  y += 24;
  addLine(
    'This invoice is issued by ElixClinix for the consultation service described above. Payment should be made using the link shared by our patient service team.',
    9
  );

  return doc;
}

export async function generateConsultationInvoicePdfBlob(
  input: ConsultationInvoicePdfInput
): Promise<Blob> {
  const doc = await buildConsultationInvoicePdf(input);
  return doc.output('blob');
}

export async function downloadConsultationInvoicePdf(input: ConsultationInvoicePdfInput) {
  const blob = await generateConsultationInvoicePdfBlob(input);
  const safeName = (input.patientName ?? 'patient').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `consultation-invoice-${safeName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
