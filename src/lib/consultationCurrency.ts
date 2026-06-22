import type { ConsultationCurrency } from '../types/doctor';

export type { ConsultationCurrency };

export const CONSULTATION_CURRENCY_OPTIONS: { value: ConsultationCurrency; label: string }[] = [
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'INR', label: 'INR — Indian Rupee (₹)' }
];

export function normalizeConsultationCurrency(value: unknown): ConsultationCurrency {
  return value === 'INR' ? 'INR' : 'USD';
}

export function formatConsultationFee(amount: number, currency: ConsultationCurrency = 'USD'): string {
  const value = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

/** Helvetica-safe labels for jsPDF invoices (standard fonts cannot render ₹). */
export function formatConsultationFeeForPdf(
  amount: number,
  currency: ConsultationCurrency = 'USD'
): string {
  const value = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    maximumFractionDigits: 0
  }).format(value);
  return currency === 'INR' ? `Rs. ${formatted}` : `$${formatted}`;
}

export function consultationCurrencySymbol(currency: ConsultationCurrency): string {
  return currency === 'INR' ? '₹' : '$';
}
