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

/**
 * Resolve PSE clinic display name for PDFs.
 * Prefers an existing name; otherwise looks up pse_clinics by id.
 */
export async function resolvePdfClinicName(
  clinicId?: string | null,
  clinicName?: string | null
): Promise<string | null> {
  const existing = clinicName?.trim() || null;
  if (existing) return existing;
  const id = clinicId?.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from('pse_clinics')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return 'Clinic workspace';
  return (data.name as string | null)?.trim() || 'Clinic workspace';
}

/**
 * Resolve clinic id/name for PDF issuer blocks (PSE clinic requests only).
 * Falls back to the doctor's clinic workspace, then the patient's clinic.
 */
export async function resolvePdfClinicContext(input: {
  clinicId?: string | null;
  clinicName?: string | null;
  doctor?: Doctor | null;
  patientId?: string | null;
}): Promise<{ clinicId: string | null; clinicName: string | null }> {
  let clinicId =
    input.clinicId?.trim() ||
    input.doctor?.clinic_id?.trim() ||
    null;
  let clinicName =
    input.clinicName?.trim() ||
    input.doctor?.pse_clinic_name?.trim() ||
    null;

  if (!clinicId && input.patientId?.trim()) {
    const patientAuthId = input.patientId.trim();
    const withJoin = await supabase
      .from('patients')
      .select('clinic_id, pse_clinics(name)')
      .eq('auth_user_id', patientAuthId)
      .maybeSingle();

    let row = withJoin.data as {
      clinic_id?: string | null;
      pse_clinics?: { name?: string | null } | { name?: string | null }[] | null;
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
    if (!clinicName && row && 'pse_clinics' in row && row.pse_clinics) {
      const ref = row.pse_clinics;
      clinicName = (Array.isArray(ref) ? ref[0]?.name : ref.name)?.trim() || null;
    }
  }

  if (!clinicId) {
    return { clinicId: null, clinicName: null };
  }

  clinicName = await resolvePdfClinicName(clinicId, clinicName);
  return { clinicId, clinicName };
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
  const displayName = pseClinicName || doctorClinicName;

  const addressLines: string[] = [];
  if (displayName) addressLines.push(displayName);
  if (doctor) {
    for (const line of formatDoctorClinicStreetAddressLines(doctor)) {
      if (displayName && line.trim().toLowerCase() === displayName.toLowerCase()) continue;
      addressLines.push(line);
    }
  }

  // Always keep the clinic name line when clinic_id is present, even without street address.
  if (!addressLines.length && !doctor?.clinic_website?.trim()) {
    if (displayName) return { addressLines: [displayName], website: null };
    return { addressLines: ['Clinic workspace'], website: null };
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
    doctor?: Doctor | null;
  }
) {
  const { margin, leftColWidth } = options;
  addLine(ELIX_BRAND.legalName, 11, true, margin, leftColWidth);
  addLine(ELIX_BRAND.tagline, 10, false, margin, leftColWidth);

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

  addLine(ELIX_BRAND.email, 10, false, margin, leftColWidth);
  addLine(ELIX_BRAND.website, 10, false, margin, leftColWidth);
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
