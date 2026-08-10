import type { ConsultationCurrency, ConsultationTier, Doctor } from '../types/doctor';
import { formatConsultationFee, normalizeConsultationCurrency } from './consultationCurrency';

/** Standard session lengths used for doctor profile tier storage (not shown on consultation screens). */
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

export function normalizeConsultationDurationMinutes(value: unknown): number | null {
  if (value == null || value === '') return null;
  const minutes = Math.round(Number(value));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export function getTierForDuration(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>,
  durationMinutes: number
): ConsultationTier | null {
  const duration = normalizeConsultationDurationMinutes(durationMinutes);
  if (duration == null) return null;
  const tiers = getDoctorConsultationTiers(doctor);
  return tiers.find((tier) => tier.duration_minutes === duration) ?? null;
}

export function getTierFeeFromTiers(
  tiers: ConsultationTier[] | null | undefined,
  durationMinutes: unknown
): number | null {
  const duration = normalizeConsultationDurationMinutes(durationMinutes);
  if (duration == null || !tiers?.length) return null;
  const tier = tiers.find((item) => item.duration_minutes === duration);
  if (!tier || !Number.isFinite(tier.fee_usd) || tier.fee_usd <= 0) return null;
  return tier.fee_usd;
}

export function getTierFeeUsd(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>,
  durationMinutes: number
): number | null {
  const tier = getTierForDuration(doctor, durationMinutes);
  if (!tier || tier.fee_usd <= 0) return null;
  return tier.fee_usd;
}

/** Primary consultation tier used across patient/PSE/admin/doctor consultation screens. */
export function getPrimaryConsultationTier(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>
): ConsultationTier | null {
  const tiers = getOfferedConsultationTiers(doctor);
  if (!tiers.length) return null;
  const thirty = tiers.find((tier) => tier.duration_minutes === 30 && tier.fee_usd > 0);
  if (thirty) return thirty;
  const offered = tiers.filter((tier) => tier.fee_usd > 0);
  return offered[0] ?? tiers[0] ?? null;
}

export function getPrimaryConsultationDurationMinutes(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>
): number | null {
  const tier = getPrimaryConsultationTier(doctor);
  return tier ? tier.duration_minutes : null;
}

export function getPrimaryConsultationFeeUsd(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd'>
): number | null {
  const tier = getPrimaryConsultationTier(doctor);
  if (!tier || tier.fee_usd <= 0) return null;
  return tier.fee_usd;
}

/**
 * Resolve which tier to charge: explicit duration when present, otherwise the doctor's primary fee.
 * Internal only — duration is never shown on consultation screens.
 */
export function resolveConsultationPricing(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd' | 'consultation_currency'>,
  durationMinutes?: number | null
): {
  durationMinutes: number | null;
  feeUsd: number | null;
  currency: ConsultationCurrency;
} {
  const explicit = normalizeConsultationDurationMinutes(durationMinutes);
  if (explicit != null) {
    const fee = getTierFeeUsd(doctor, explicit);
    if (fee != null) {
      return {
        durationMinutes: explicit,
        feeUsd: fee,
        currency: doctorConsultationCurrency(doctor)
      };
    }
  }
  const primary = getPrimaryConsultationTier(doctor);
  return {
    durationMinutes: primary?.duration_minutes ?? null,
    feeUsd: primary && primary.fee_usd > 0 ? primary.fee_usd : null,
    currency: doctorConsultationCurrency(doctor)
  };
}

export function doctorConsultationCurrency(
  doctor: Pick<Doctor, 'consultation_currency'>
): ConsultationCurrency {
  return normalizeConsultationCurrency(doctor.consultation_currency);
}

/** Fee label for consultation screens — never includes duration. */
export function formatConsultationTierLabel(
  tier: ConsultationTier,
  options?: { showFee?: boolean; showDuration?: boolean; currency?: ConsultationCurrency }
): string {
  const showFee = options?.showFee ?? tier.fee_usd > 0;
  const showDuration = options?.showDuration ?? false;
  const duration = formatDurationMinutesLabel(tier.duration_minutes);
  const currency = options?.currency ?? 'USD';
  if (showFee && showDuration) {
    return `${duration} · ${formatConsultationFee(tier.fee_usd, currency)}`;
  }
  if (showFee) {
    return formatConsultationFee(tier.fee_usd, currency);
  }
  return showDuration ? duration : formatConsultationFee(tier.fee_usd, currency);
}

/** Doctor profile / browse views: primary consultation charge only. */
export function formatConsultationTiersSummary(
  doctor: Pick<Doctor, 'consultation_tiers' | 'consultation_fee' | 'fee_usd' | 'consultation_currency'>
): string {
  const currency = doctorConsultationCurrency(doctor);
  const primary = getPrimaryConsultationTier(doctor);
  if (!primary || primary.fee_usd <= 0) return 'Fee on request';
  return formatConsultationFee(primary.fee_usd, currency);
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
