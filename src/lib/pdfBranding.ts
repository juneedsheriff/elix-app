import type { Doctor } from '../types/doctor';
import { ELIX_LOGO_SRC } from './brandAssets';
import { supabase } from './supabase';

export const ELIX_BRAND = {
  legalName: 'ElixClinix',
  tagline: 'Doctor consultation & teleconsultation platform',
  email: 'support@elixclinix.com',
  website: 'www.elixclinix.com'
} as const;

export type PdfPseClinicContact = {
  addressLines: string[];
  website: string | null;
};

export function formatDoctorClinicAddressLines(doctor: Doctor): string[] {
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

/** Street / city / country only — no clinic or hospital name. */
export function formatDoctorClinicStreetAddressLines(doctor: Doctor): string[] {
  const lines: string[] = [];
  const street = [doctor.clinic_street, doctor.clinic_location].filter(Boolean).join(', ');
  if (street) lines.push(street);
  const cityLine = [doctor.clinic_city, doctor.clinic_state, doctor.clinic_zipcode]
    .filter(Boolean)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  if (doctor.clinic_country?.trim()) lines.push(doctor.clinic_country.trim());
  return lines;
}

export function formatDoctorContactPhone(doctor: Doctor): string | null {
  return doctor.mobile_no?.trim() || doctor.phone?.trim() || null;
}

/** Placeholder clinic labels that must not appear on printed PDFs. */
export function isPlaceholderClinicLabel(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return true;
  return /^clinic\s+workspace$/i.test(trimmed);
}

function normalizeAddressCompareKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:/\\|_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicate address lines (exact + contained duplicates) so clinic profile
 * addresses are not printed repeatedly under the logo.
 */
export function uniquePdfAddressLines(lines: Array<string | null | undefined>): string[] {
  const cleaned = lines
    .flatMap((line) => String(line ?? '').split(/\r?\n+/))
    .map((line) => collapseRepeatedAddressText(line.replace(/\s+/g, ' ').trim()))
    .filter((line) => line && !isPlaceholderClinicLabel(line));

  const unique: string[] = [];
  for (const line of cleaned) {
    const key = normalizeAddressCompareKey(line);
    if (!key) continue;
    if (unique.some((existing) => normalizeAddressCompareKey(existing) === key)) continue;
    unique.push(line);
  }

  // Drop shorter lines that are fully contained in a longer line.
  return unique.filter((line, index) => {
    const key = normalizeAddressCompareKey(line);
    return !unique.some((other, otherIndex) => {
      if (index === otherIndex) return false;
      const otherKey = normalizeAddressCompareKey(other);
      return otherKey.length > key.length && otherKey.includes(key);
    });
  });
}

/** Collapse accidental double-paste of the same address into one line. */
function collapseRepeatedAddressText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 24) return trimmed;

  const halves = trimmed.split(/\s*[|;]\s*|\s{2,}/).map((part) => part.trim()).filter(Boolean);
  if (halves.length >= 2) {
    const firstKey = normalizeAddressCompareKey(halves[0]!);
    if (firstKey && halves.every((part) => normalizeAddressCompareKey(part) === firstKey)) {
      return halves[0]!;
    }
  }

  const mid = Math.floor(trimmed.length / 2);
  for (let offset = 0; offset <= 8; offset += 1) {
    const left = trimmed.slice(0, mid - offset).trim().replace(/[.,;]+$/, '');
    const right = trimmed.slice(mid - offset).trim().replace(/^[.,;]+/, '').trim();
    if (left.length < 20 || right.length < 20) continue;
    if (normalizeAddressCompareKey(left) === normalizeAddressCompareKey(right)) {
      return left;
    }
  }

  return trimmed;
}

/**
 * Resolve PSE clinic display name for PDFs.
 * Prefers an existing name; otherwise looks up pse_clinics by id.
 * Returns null instead of the "Clinic workspace" placeholder for print surfaces.
 */
export async function resolvePdfClinicName(
  clinicId?: string | null,
  clinicName?: string | null
): Promise<string | null> {
  const existing = clinicName?.trim() || null;
  if (existing && !isPlaceholderClinicLabel(existing)) return existing;
  const id = clinicId?.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from('pse_clinics')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const name = (data.name as string | null)?.trim() || null;
  return isPlaceholderClinicLabel(name) ? null : name;
}

/**
 * Resolve clinic id/name/address for PDF issuer blocks (PSE clinic requests only).
 * Falls back to the doctor's clinic workspace, then the patient's clinic.
 * Under-logo address prefers the clinic profile location once (no doctor-address merge).
 */
export async function resolvePdfClinicContext(input: {
  clinicId?: string | null;
  clinicName?: string | null;
  doctor?: Doctor | null;
  patientId?: string | null;
}): Promise<{
  clinicId: string | null;
  clinicName: string | null;
  clinicAddressLines: string[];
}> {
  let clinicId =
    input.clinicId?.trim() ||
    input.doctor?.clinic_id?.trim() ||
    null;
  let clinicName =
    input.clinicName?.trim() ||
    input.doctor?.pse_clinic_name?.trim() ||
    null;
  let clinicLocation: string | null = null;

  if (!clinicId && input.patientId?.trim()) {
    const patientAuthId = input.patientId.trim();
    const withJoin = await supabase
      .from('patients')
      .select('clinic_id, pse_clinics(name, location)')
      .eq('auth_user_id', patientAuthId)
      .maybeSingle();

    let row = withJoin.data as {
      clinic_id?: string | null;
      pse_clinics?:
        | { name?: string | null; location?: string | null }
        | { name?: string | null; location?: string | null }[]
        | null;
    } | null;

    if (withJoin.error || !row) {
      const plain = await supabase
        .from('patients')
        .select('clinic_id')
        .eq('auth_user_id', patientAuthId)
        .maybeSingle();
      row = plain.data as { clinic_id?: string | null } | null;
    }

    clinicId = row?.clinic_id?.trim() || null;
    if (row && 'pse_clinics' in row && row.pse_clinics) {
      const ref = row.pse_clinics;
      const clinicRef = Array.isArray(ref) ? ref[0] : ref;
      clinicName = clinicName || clinicRef?.name?.trim() || null;
      clinicLocation = clinicRef?.location?.trim() || null;
    }
  }

  if (!clinicId) {
    return { clinicId: null, clinicName: null, clinicAddressLines: [] };
  }

  if (!clinicLocation) {
    const { data } = await supabase
      .from('pse_clinics')
      .select('name, location')
      .eq('id', clinicId)
      .maybeSingle();
    if (data) {
      clinicName = clinicName || (data.name as string | null)?.trim() || null;
      clinicLocation = (data.location as string | null)?.trim() || null;
    }
  }

  clinicName = await resolvePdfClinicName(clinicId, clinicName);

  // Prefer clinic-profile location as the single under-logo address source.
  // Only fall back to the doctor's clinic street fields when no branch location exists.
  const addressSource = clinicLocation?.trim()
    ? [clinicLocation]
    : input.doctor
      ? formatDoctorClinicStreetAddressLines(input.doctor)
      : [];

  const clinicAddressLines = uniquePdfAddressLines(addressSource);

  return { clinicId, clinicName, clinicAddressLines };
}

/**
 * Clinic name + address for PDFs — only when the request is from a PSE clinic workspace.
 * Global PSE requests return null (no doctor clinic contact block).
 * Uses a single clinic name (PSE workspace preferred) so the name never repeats.
 */
export function resolvePseClinicContactForPdf(input: {
  clinicId?: string | null;
  clinicName?: string | null;
  doctor?: Doctor | null;
}): PdfPseClinicContact | null {
  if (!input.clinicId?.trim()) return null;

  const doctor = input.doctor ?? null;
  const pseClinicName = input.clinicName?.trim() || null;
  const doctorClinicName =
    doctor?.clinic_name?.trim() || doctor?.hospital?.trim() || null;
  const displayName =
    (pseClinicName && !isPlaceholderClinicLabel(pseClinicName) ? pseClinicName : null) ||
    (doctorClinicName && !isPlaceholderClinicLabel(doctorClinicName) ? doctorClinicName : null);

  const addressLines = uniquePdfAddressLines([
    displayName,
    ...(doctor ? formatDoctorClinicStreetAddressLines(doctor) : [])
  ]);

  if (!addressLines.length && !doctor?.clinic_website?.trim()) {
    return null;
  }

  const website = doctor?.clinic_website?.trim() || null;
  return { addressLines, website };
}

/**
 * Issuer contact block used on invoice, consultation notes, and order PDFs:
 * brand, optional PSE clinic name + address, then Elix email + website.
 * Clinic address appears only when request.clinic_id is set (not global PSE).
 */
export function writePdfIssuerContactBlock(
  addLine: (text: string, size: number, bold?: boolean, x?: number, maxWidth?: number) => void,
  options: {
    margin: number;
    leftColWidth: number;
    clinicId?: string | null;
    clinicName?: string | null;
    clinicAddressLines?: string[] | null;
    doctor?: Doctor | null;
  }
) {
  const { margin, leftColWidth } = options;
  addLine(ELIX_BRAND.legalName, 11, true, margin, leftColWidth);
  addLine(ELIX_BRAND.tagline, 10, false, margin, leftColWidth);

  const explicitAddress = uniquePdfAddressLines(options.clinicAddressLines ?? []);
  if (explicitAddress.length) {
    for (const line of explicitAddress) {
      addLine(line, 10, false, margin, leftColWidth);
    }
  } else {
    const clinicContact = resolvePseClinicContactForPdf({
      clinicId: options.clinicId,
      clinicName: options.clinicName,
      doctor: options.doctor
    });
    if (clinicContact) {
      for (const line of clinicContact.addressLines) {
        addLine(line, 10, false, margin, leftColWidth);
      }
    }
  }

  addLine(ELIX_BRAND.email, 10, false, margin, leftColWidth);
  addLine(ELIX_BRAND.website, 10, false, margin, leftColWidth);
}

/** Reserved vertical space at the bottom of each PDF page for the doctor signature. */
export const PDF_SIGNATURE_RESERVE_PT = 88;

/**
 * Draw a print-friendly doctor signature area near the page footer.
 * Call after document content so it does not overlap clinical text.
 */
export function writePdfDoctorSignatureBlock(
  doc: {
    setFont: (font: string, style: string) => void;
    setFontSize: (size: number) => void;
    setDrawColor: (r: number, g: number, b: number) => void;
    setTextColor: (r: number, g: number, b: number) => void;
    line: (x1: number, y1: number, x2: number, y2: number) => void;
    text: (
      text: string,
      x: number,
      y: number,
      options?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }
    ) => void;
    getTextWidth: (text: string) => number;
  },
  options: {
    margin: number;
    pageWidth: number;
    pageHeight: number;
    doctorName?: string | null;
    y?: number;
  }
): number {
  const { margin, pageWidth, pageHeight } = options;
  const signatureWidth = Math.min(220, pageWidth - margin * 2);
  const minY = pageHeight - margin - 58;
  let y = Math.max(options.y ?? minY, minY);

  doc.setDrawColor(148, 163, 184);
  doc.setTextColor(15, 23, 42);
  doc.line(margin, y, margin + signatureWidth, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text("Doctor's Signature", margin, y);
  y += 14;

  const name = options.doctorName?.trim();
  if (name) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(name, margin, y);
    doc.setTextColor(15, 23, 42);
    y += 12;
  }

  return y;
}

export async function loadElixLogoDataUrl(): Promise<string | null> {
  const candidates = [ELIX_LOGO_SRC, '/icons/icon-192.png'];
  for (const path of candidates) {
    try {
      const response = await fetch(path);
      if (!response.ok) continue;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      /* try next */
    }
  }
  return null;
}
