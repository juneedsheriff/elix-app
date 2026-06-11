import type { ConsultationCurrency, ConsultationTier, Doctor } from '../types/doctor';
import { formatConsultationFee, normalizeConsultationCurrency } from './consultationCurrency';

/** Standard session lengths doctors can price and patients can choose. */
export const STANDARD_CONSULTATION_DURATIONS = [15, 30, 45, 60] as const;

export type StandardConsultationDuration = (typeof STANDARD_CONSULTATION_DURATIONS)[number];

export function formatDurationMinutesLabel(minutes: number): string {
  if (minutes === 60) return '1 hour';
  return `${minutes} min`;
}

export function defaultConsultationTiers(feeUsd = 0): ConsultationTier[] {
  const fee30 = Math.max(0, Math.round(feeUsd));
  if (fee30 > 0) {
    return STANDARD_CONSULTATION_DURATIONS.map((duration) => ({
      duration_minutes: duration,
      fee_usd: Math.max(0, Math.round((fee30 * duration) / 30))
    }));
  }
  return [
    { duration_minutes: 15, fee_usd: 50 },
    { duration_minutes: 30, fee_usd: 100 },
    { duration_minutes: 45, fee_usd: 150 },
    { duration_minutes: 60, fee_usd: 200 }
  ];
}

/** Merge saved tiers with all standard durations so doctors always manage 15/30/45/60. */
export function ensureStandardConsultationTiers(
  tiers: ConsultationTier[],
  fallbackFeeUsd = 0
): ConsultationTier[] {
  const defaults = defaultConsultationTiers(fallbackFeeUsd);
  const byDuration = new Map(defaults.map((tier) => [tier.duration_minutes, tier]));
  for (const tier of tiers) {
    byDuration.set(tier.duration_minutes, tier);
  }
  return STANDARD_CONSULTATION_DURATIONS.map(
    (duration) => byDuration.get(duration) ?? { duration_minutes: duration, fee_usd: 0 }
  );
}

export function parseConsultationTiers(value: unknown, fallbackFeeUsd = 0): ConsultationTier[] {
  if (!Array.isArray(value) || !value.length) {
    return defaultConsultationTiers(fallbackFeeUsd);
  }

  const tiers = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const duration = Number(row.duration_minutes);
      const fee = Number(row.fee_usd);
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fee) || fee < 0) {
        return null;
      }
      return {
        duration_minutes: Math.round(duration),
        fee_usd: Math.round(fee)
      };
    })
    .filter((tier): tier is ConsultationTier => tier != null)
    .sort((a, b) => a.duration_minutes - b.duration_minutes);

  return tiers.length
    ? ensureStandardConsultationTiers(tiers, fallbackFeeUsd)
    : defaultConsultationTiers(fallbackFeeUsd);
}

export function getDoctorConsultationTiers(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>
): ConsultationTier[] {
  const fallbackFee = doctor.consultation_fee ?? doctor.fee_usd ?? 0;
  return parseConsultationTiers(doctor.consultation_tiers, fallbackFee);
}

/** Tiers the doctor offers to patients (fee greater than zero). */
export function getOfferedConsultationTiers(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>
): ConsultationTier[] {
  const offered = getDoctorConsultationTiers(doctor).filter((tier) => tier.fee_usd > 0);
  return offered.length ? offered : getDoctorConsultationTiers(doctor);
}

export function consultationDurationSelectOptions() {
  return STANDARD_CONSULTATION_DURATIONS.map((duration) => ({
    label: formatDurationMinutesLabel(duration),
    value: String(duration)
  }));
}

export function preferredDurationTiers(): ConsultationTier[] {
  return STANDARD_CONSULTATION_DURATIONS.map((duration) => ({
    duration_minutes: duration,
    fee_usd: 0
  }));
}

export function getTierForDuration(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>,
  durationMinutes: number
): ConsultationTier | null {
  const tiers = getDoctorConsultationTiers(doctor);
  return tiers.find((tier) => tier.duration_minutes === durationMinutes) ?? null;
}

export function getTierFeeUsd(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>,
  durationMinutes: number
): number | null {
  const tier = getTierForDuration(doctor, durationMinutes);
  if (!tier || tier.fee_usd <= 0) return null;
  return tier.fee_usd;
}

export function doctorConsultationCurrency(
  doctor: Pick<Doctor, 'consultation_currency'>
): ConsultationCurrency {
  return normalizeConsultationCurrency(doctor.consultation_currency);
}

export function formatConsultationTierLabel(
  tier: ConsultationTier,
  options?: { showFee?: boolean; currency?: ConsultationCurrency }
): string {
  const showFee = options?.showFee ?? tier.fee_usd > 0;
  const duration = formatDurationMinutesLabel(tier.duration_minutes);
  const currency = options?.currency ?? 'USD';
  return showFee ? `${duration} · ${formatConsultationFee(tier.fee_usd, currency)}` : duration;
}

export function formatConsultationTiersSummary(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd' | 'consultation_currency'>
): string {
  const currency = doctorConsultationCurrency(doctor);
  return getOfferedConsultationTiers(doctor)
    .map((tier) => formatConsultationTierLabel(tier, { currency }))
    .join(' · ');
}

export function normalizeConsultationTiersInput(tiers: ConsultationTier[]): ConsultationTier[] {
  return ensureStandardConsultationTiers(normalizeConsultationTiersRaw(tiers));
}

function normalizeConsultationTiersRaw(tiers: ConsultationTier[]): ConsultationTier[] {
  const byDuration = new Map<number, ConsultationTier>();
  for (const tier of tiers) {
    const duration = Math.round(Number(tier.duration_minutes));
    const fee = Math.max(0, Math.round(Number(tier.fee_usd)));
    if (!Number.isFinite(duration) || duration <= 0) continue;
    byDuration.set(duration, { duration_minutes: duration, fee_usd: fee });
  }
  return [...byDuration.values()].sort((a, b) => a.duration_minutes - b.duration_minutes);
}

export function primaryConsultationFeeFromTiers(tiers: ConsultationTier[]): number {
  const thirty = tiers.find((tier) => tier.duration_minutes === 30);
  if (thirty && thirty.fee_usd > 0) return thirty.fee_usd;
  const offered = tiers.filter((tier) => tier.fee_usd > 0);
  if (offered.length) return offered[offered.length - 1].fee_usd;
  return 0;
}
