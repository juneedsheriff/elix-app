/** Parse a numeric vital value, ignoring units like cm / kg. */
export function parseVitalNumber(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const match = value.trim().replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * BMI from height (cm) and weight (kg).
 * Returns null when either value is missing or non-positive.
 */
export function calculateBmi(
  heightCm: string | number | null | undefined,
  weightKg: string | number | null | undefined
): number | null {
  const height =
    typeof heightCm === 'number' ? heightCm : parseVitalNumber(heightCm);
  const weight =
    typeof weightKg === 'number' ? weightKg : parseVitalNumber(weightKg);
  if (height == null || weight == null || height <= 0 || weight <= 0) return null;
  const heightM = height / 100;
  if (heightM <= 0) return null;
  const bmi = weight / (heightM * heightM);
  if (!Number.isFinite(bmi) || bmi <= 0) return null;
  return Math.round(bmi * 10) / 10;
}

export function formatBmi(bmi: number | null | undefined): string {
  if (bmi == null || !Number.isFinite(bmi)) return '';
  return bmi.toFixed(1);
}
