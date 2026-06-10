import type { Patient } from '../types/patient';

const REQUIRED_FIELDS: Array<keyof Patient> = [
  'full_name',
  'email',
  'phone',
  'gender',
  'date_of_birth',
  'blood_group'
];

function hasAddress(patient: Patient): boolean {
  return Boolean(patient.address?.trim() || patient.city?.trim());
}

export function isPatientProfileComplete(patient: Patient | null | undefined): boolean {
  if (!patient) return false;
  if (patient.profile_completed_at) return true;

  for (const field of REQUIRED_FIELDS) {
    const value = patient[field];
    if (typeof value !== 'string' || !value.trim()) return false;
  }

  return hasAddress(patient);
}

export function patientProfileMissingFields(patient: Patient | null | undefined): string[] {
  if (!patient) return ['profile'];

  const missing: string[] = [];
  if (!patient.phone?.trim()) missing.push('phone');
  if (!patient.gender?.trim()) missing.push('gender');
  if (!patient.date_of_birth?.trim()) missing.push('date of birth');
  if (!patient.blood_group?.trim()) missing.push('blood group');
  if (!hasAddress(patient)) missing.push('address');
  return missing;
}

export function ageFromDateOfBirth(dob: string): number | null {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}
