import type { ConsultationCurrency } from '../types/doctor';

export const PSE_COUNTRY_OPTIONS = [
  { value: 'India', label: 'India' },
  { value: 'United States', label: 'United States' },
  { value: 'Canada', label: 'Canada' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Australia', label: 'Australia' }
] as const;

export type PseCountry = (typeof PSE_COUNTRY_OPTIONS)[number]['value'];

export const DEFAULT_PSE_COUNTRY: PseCountry = 'India';

export function normalizePseCountry(value: unknown): PseCountry {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const match = PSE_COUNTRY_OPTIONS.find((option) => option.value === trimmed);
  return match?.value ?? DEFAULT_PSE_COUNTRY;
}

/** India clinics bill in INR; every other PSE country bills in USD. */
export function consultationCurrencyForPseCountry(country: unknown): ConsultationCurrency {
  return normalizePseCountry(country) === 'India' ? 'INR' : 'USD';
}
