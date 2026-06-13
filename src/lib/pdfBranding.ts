import type { Doctor } from '../types/doctor';

export const ELIX_BRAND = {
  legalName: 'Elix Health',
  tagline: 'Second opinion & teleconsultation platform',
  email: 'support@elixhealth.com',
  website: 'www.elixhealth.com'
} as const;

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

export function formatDoctorContactPhone(doctor: Doctor): string | null {
  return doctor.mobile_no?.trim() || doctor.phone?.trim() || null;
}

export async function loadElixLogoDataUrl(): Promise<string | null> {
  const candidates = ['/icons/elix-logo-transparent.png', '/icons/icon-192.png'];
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
