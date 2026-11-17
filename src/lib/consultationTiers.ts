import type { ConsultationCurrency, ConsultationTier, Doctor } from '../types/doctor';
import { formatConsultationFee, normalizeConsultationCurrency } from './consultationCurrency';

/** Standard session lengths used for doctor profile tier storage (not shown on consultation screens). */
export const STANDARD_CONSULTATION_DURATIONS = [15, 30, 45, 60] as const;

export type StandardConsultationDuration = (typeof STANDARD_CONSULTATION_DURATIONS)[number];

export function formatDurationMinutesLabel(minutes: number): string {
  if (minutes === 60) return '1 hour';
  return `${minutes} min`;
}

export function defaultConsultationTiers(feeUsd = 0, feeInr = 0): ConsultationTier[] {
  const fee30Usd = Math.max(0, Math.round(feeUsd));
  const fee30Inr = Math.max(0, Math.round(feeInr));
  if (fee30Usd > 0 || fee30Inr > 0) {
    return STANDARD_CONSULTATION_DURATIONS.map((duration) => ({
      duration_minutes: duration,
      fee_usd: fee30Usd > 0 ? Math.max(0, Math.round((fee30Usd * duration) / 30)) : 0,
      fee_inr: fee30Inr > 0 ? Math.max(0, Math.round((fee30Inr * duration) / 30)) : 0
    }));
  }
  return [
    { duration_minutes: 15, fee_usd: 50, fee_inr: 0 },
    { duration_minutes: 30, fee_usd: 100, fee_inr: 0 },
    { duration_minutes: 45, fee_usd: 150, fee_inr: 0 },
    { duration_minutes: 60, fee_usd: 200, fee_inr: 0 }
  ];
}

export function tierFeeForCurrency(
  tier: Pick<ConsultationTier, 'fee_usd' | 'fee_inr'> | null | undefined,
  currency: ConsultationCurrency
): number {
  if (!tier) return 0;
  if (currency === 'INR') {
    return Math.max(0, Math.round(Number(tier.fee_inr ?? 0)));
  }
  return Math.max(0, Math.round(Number(tier.fee_usd ?? 0)));
}

/** Merge saved tiers with all standard durations so doctors always manage 15/30/45/60. */
export function ensureStandardConsultationTiers(
  tiers: ConsultationTier[],
  fallbackFeeUsd = 0,
  fallbackFeeInr = 0
): ConsultationTier[] {
  const defaults = defaultConsultationTiers(fallbackFeeUsd, fallbackFeeInr);
  const byDuration = new Map(defaults.map((tier) => [tier.duration_minutes, tier]));
  for (const tier of tiers) {
    byDuration.set(tier.duration_minutes, {
      duration_minutes: tier.duration_minutes,
      fee_usd: Math.max(0, Math.round(Number(tier.fee_usd ?? 0))),
      fee_inr: Math.max(0, Math.round(Number(tier.fee_inr ?? 0)))
    });
  }
  return STANDARD_CONSULTATION_DURATIONS.map(
    (duration) =>
      byDuration.get(duration) ?? { duration_minutes: duration, fee_usd: 0, fee_inr: 0 }
  );
}

export function parseConsultationTiers(
  value: unknown,
  fallbackFeeUsd = 0,
  options?: { fallbackFeeInr?: number; legacyCurrency?: ConsultationCurrency | null }
): ConsultationTier[] {
  const fallbackFeeInr = options?.fallbackFeeInr ?? 0;
  if (!Array.isArray(value) || !value.length) {
    return defaultConsultationTiers(fallbackFeeUsd, fallbackFeeInr);
  }

  const legacyCurrency = options?.legacyCurrency ?? null;

  const tiers = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const duration = Number(row.duration_minutes);
      const feeUsdRaw = Number(row.fee_usd);
      const hasFeeInr = row.fee_inr != null && row.fee_inr !== '';
      const feeInrRaw = hasFeeInr ? Number(row.fee_inr) : NaN;
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(feeUsdRaw) || feeUsdRaw < 0) {
        return null;
      }
      // Older rows stored a single amount in fee_usd using consultation_currency.
      if (!hasFeeInr && legacyCurrency === 'INR') {
        return {
          duration_minutes: Math.round(duration),
          fee_usd: 0,
          fee_inr: Math.round(feeUsdRaw)
        };
      }
      return {
        duration_minutes: Math.round(duration),
        fee_usd: Math.round(feeUsdRaw),
        fee_inr: Number.isFinite(feeInrRaw) && feeInrRaw >= 0 ? Math.round(feeInrRaw) : 0
      };
    })
    .filter((tier): tier is ConsultationTier => tier != null)
    .sort((a, b) => a.duration_minutes - b.duration_minutes);

  return tiers.length
    ? ensureStandardConsultationTiers(tiers, fallbackFeeUsd, fallbackFeeInr)
    : defaultConsultationTiers(fallbackFeeUsd, fallbackFeeInr);
}

export function getDoctorConsultationTiers(
  doctor: Pick<
    Doctor,
    'consultation_tiers' | 'consultation_fee' | 'consultation_fee_inr' | 'fee_usd' | 'consultation_currency'
  >
): ConsultationTier[] {
  const fallbackFee = doctor.consultation_fee ?? doctor.fee_usd ?? 0;
  return parseConsultationTiers(doctor.consultation_tiers, fallbackFee, {
    fallbackFeeInr: doctor.consultation_fee_inr ?? 0,
    legacyCurrency: doctor.consultation_currency
  });
}

/** Tiers the doctor offers to patients (any currency fee greater than zero). */
export function getOfferedConsultationTiers(
  doctor: Pick<
    Doctor,
    'consultation_tiers' | 'consultation_fee' | 'consultation_fee_inr' | 'fee_usd' | 'consultation_currency'
  >
): ConsultationTier[] {
  const offered = getDoctorConsultationTiers(doctor).filter(
    (tier) => tier.fee_usd > 0 || (tier.fee_inr ?? 0) > 0
  );
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
    fee_usd: 0,
    fee_inr: 0
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
  doctor: Pick<
    Doctor,
    'consultation_tiers' | 'consultation_fee' | 'consultation_fee_inr' | 'fee_usd' | 'consultation_currency'
  >
): ConsultationTier | null {
  const tiers = getOfferedConsultationTiers(doctor);
  if (!tiers.length) return null;
  const thirty = tiers.find(
    (tier) => tier.duration_minutes === 30 && (tier.fee_usd > 0 || (tier.fee_inr ?? 0) > 0)
  );
  if (thirty) return thirty;
  const offered = tiers.filter((tier) => tier.fee_usd > 0 || (tier.fee_inr ?? 0) > 0);
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
  doctor: Pick<
    Doctor,
    'consultation_tiers' | 'consultation_fee' | 'consultation_fee_inr' | 'fee_usd' | 'consultation_currency'
  >,
  durationMinutes?: number | null,
  displayCurrency?: ConsultationCurrency | null
): {
  durationMinutes: number | null;
  feeUsd: number | null;
  currency: ConsultationCurrency;
} {
  const currency = displayCurrency
    ? normalizeConsultationCurrency(displayCurrency)
    : doctorConsultationCurrency(doctor);
  const explicit = normalizeConsultationDurationMinutes(durationMinutes);
  if (explicit != null) {
    const tier = getTierForDuration(doctor, explicit);
    const fee = tierFeeForCurrency(tier, currency);
    if (fee > 0) {
      return {
        durationMinutes: explicit,
        feeUsd: fee,
        currency
      };
    }
  }
  const primary = getPrimaryConsultationTier(doctor);
  const primaryFee = tierFeeForCurrency(primary, currency);
  return {
    durationMinutes: primary?.duration_minutes ?? null,
    feeUsd: primaryFee > 0 ? primaryFee : null,
    currency
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
  const currency = options?.currency ?? 'USD';
  const fee = tierFeeForCurrency(tier, currency);
  const showFee = options?.showFee ?? fee > 0;
  const showDuration = options?.showDuration ?? false;
  const duration = formatDurationMinutesLabel(tier.duration_minutes);
  if (showFee && showDuration) {
    return `${duration} · ${formatConsultationFee(fee, currency)}`;
  }
  if (showFee) {
    return formatConsultationFee(fee, currency);
  }
  return showDuration ? duration : formatConsultationFee(fee, currency);
}

/** Doctor profile / browse views: primary consultation charge only. */
export function formatConsultationTiersSummary(
  doctor: Pick<
    Doctor,
    'consultation_tiers' | 'consultation_fee' | 'consultation_fee_inr' | 'fee_usd' | 'consultation_currency'
  >,
  displayCurrency?: ConsultationCurrency | null
): string {
  const currency = displayCurrency
    ? normalizeConsultationCurrency(displayCurrency)
    : doctorConsultationCurrency(doctor);
  const primary = getPrimaryConsultationTier(doctor);
  const fee = tierFeeForCurrency(primary, currency);
  if (!primary || fee <= 0) return 'Fee on request';
  return formatConsultationFee(fee, currency);
}

export function normalizeConsultationTiersInput(tiers: ConsultationTier[]): ConsultationTier[] {
  return ensureStandardConsultationTiers(normalizeConsultationTiersRaw(tiers));
}

function normalizeConsultationTiersRaw(tiers: ConsultationTier[]): ConsultationTier[] {
  const byDuration = new Map<number, ConsultationTier>();
  for (const tier of tiers) {
    const duration = Math.round(Number(tier.duration_minutes));
    const feeUsd = Math.max(0, Math.round(Number(tier.fee_usd)));
    const feeInr = Math.max(0, Math.round(Number(tier.fee_inr ?? 0)));
    if (!Number.isFinite(duration) || duration <= 0) continue;
    byDuration.set(duration, { duration_minutes: duration, fee_usd: feeUsd, fee_inr: feeInr });
  }
  return [...byDuration.values()].sort((a, b) => a.duration_minutes - b.duration_minutes);
}

export function primaryConsultationFeeFromTiers(
  tiers: ConsultationTier[],
  currency: ConsultationCurrency = 'USD'
): number {
  const thirty = tiers.find((tier) => tier.duration_minutes === 30);
  const thirtyFee = tierFeeForCurrency(thirty, currency);
  if (thirtyFee > 0) return thirtyFee;
  const offered = tiers.filter((tier) => tierFeeForCurrency(tier, currency) > 0);
  if (offered.length) return tierFeeForCurrency(offered[offered.length - 1], currency);
  return 0;
}

/** Apply the same USD and INR primary charges across all standard durations. */
export function tiersFromDualFees(feeUsd: number, feeInr: number): ConsultationTier[] {
  const usd = Math.max(0, Math.round(feeUsd));
  const inr = Math.max(0, Math.round(feeInr));
  return ensureStandardConsultationTiers([], usd, inr).map((tier) => ({
    ...tier,
    fee_usd: usd,
    fee_inr: inr
  }));
}
