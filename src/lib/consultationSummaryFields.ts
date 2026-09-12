import type { ConsultationSummary } from '../types/opinionRequest';

/**
 * Doctor consultation form / summary display order.
 * Lab Order remains available for generating a separate lab order PDF.
 */
export const CONSULTATION_SUMMARY_FIELDS = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'history_present_illness', label: 'History of Present Illness' },
  { key: 'past_medical_history', label: 'Past Medical/Surgical/Social History' },
  { key: 'review_of_systems', label: 'Review of Systems (ROS)' },
  { key: 'vital_signs', label: 'Vital Signs' },
  { key: 'physical_examination', label: 'Physical Examination (PE)' },
  { key: 'assessment_plan', label: 'Assessment/Plan' },
  { key: 'prescription', label: 'Prescription' },
  { key: 'advise_food_lifestyle', label: 'Advise on Food/Lifestyle' },
  { key: 'refer_to', label: 'Refer To' },
  { key: 'followup_date', label: 'Follow-up Date' },
  { key: 'labs_diagnostics', label: 'Lab Order' }
] as const;

export type ConsultationSummaryFieldKey = (typeof CONSULTATION_SUMMARY_FIELDS)[number]['key'];

export type ConsultationSummaryFormValues = Record<ConsultationSummaryFieldKey, string>;

export function emptyConsultationSummaryValues(): ConsultationSummaryFormValues {
  return {
    chief_complaint: '',
    history_present_illness: '',
    past_medical_history: '',
    review_of_systems: '',
    vital_signs: '',
    physical_examination: '',
    assessment_plan: '',
    prescription: '',
    advise_food_lifestyle: '',
    refer_to: '',
    followup_date: '',
    labs_diagnostics: ''
  };
}

/** Local calendar date as YYYY-MM-DD (for date-input min / comparisons). */
export function localIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalize DB date / ISO string to YYYY-MM-DD for date inputs. */
export function normalizeConsultationFollowupDate(
  value: string | null | undefined
): string {
  if (!value?.trim()) return '';
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? '';
}

/** Human-readable follow-up date for PDF / doctor_response text. */
export function formatConsultationFollowupDate(
  value: string | null | undefined
): string {
  const iso = normalizeConsultationFollowupDate(value);
  if (!iso) return '';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function consultationSummaryToFormValues(
  summary: ConsultationSummary | null | undefined
): ConsultationSummaryFormValues {
  const empty = emptyConsultationSummaryValues();
  if (!summary) return empty;
  return {
    chief_complaint: summary.chief_complaint?.trim() ?? '',
    history_present_illness: summary.history_present_illness?.trim() ?? '',
    past_medical_history: summary.past_medical_history?.trim() ?? '',
    review_of_systems: summary.review_of_systems?.trim() ?? '',
    vital_signs: summary.vital_signs?.trim() ?? '',
    physical_examination: summary.physical_examination?.trim() ?? '',
    assessment_plan: summary.assessment_plan?.trim() ?? '',
    prescription: summary.prescription?.trim() ?? '',
    advise_food_lifestyle: summary.advise_food_lifestyle?.trim() ?? '',
    refer_to: summary.refer_to?.trim() ?? '',
    followup_date: normalizeConsultationFollowupDate(summary.followup_date),
    labs_diagnostics: summary.labs_diagnostics?.trim() ?? ''
  };
}

export function formatConsultationResponse(values: ConsultationSummaryFormValues): string {
  return CONSULTATION_SUMMARY_FIELDS.map(({ key, label }) => {
    const text = values[key].trim();
    if (!text) return null;
    if (key === 'followup_date') {
      const formatted = formatConsultationFollowupDate(text);
      return formatted ? `${label}:\n${formatted}` : null;
    }
    return `${label}:\n${text}`;
  })
    .filter(Boolean)
    .join('\n\n');
}
