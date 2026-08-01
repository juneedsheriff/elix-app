import type { ConsultationSummary } from '../types/opinionRequest';

export const CONSULTATION_SUMMARY_FIELDS = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'history_present_illness', label: 'History of Present Illness' },
  { key: 'past_medical_history', label: 'Past Medical History' },
  { key: 'current_medications', label: 'Current Medications' },
  { key: 'vital_signs', label: 'Vital Signs' },
  { key: 'labs_diagnostics', label: 'Labs/Diagnostics' },
  { key: 'assessment_plan', label: 'Assessment & Plan' },
  { key: 'followup_date', label: 'Follow-up Date' },
  { key: 'prescription', label: 'Prescription' }
] as const;

export type ConsultationSummaryFieldKey = (typeof CONSULTATION_SUMMARY_FIELDS)[number]['key'];

export type ConsultationSummaryFormValues = Record<ConsultationSummaryFieldKey, string>;

export function emptyConsultationSummaryValues(): ConsultationSummaryFormValues {
  return {
    chief_complaint: '',
    history_present_illness: '',
    past_medical_history: '',
    current_medications: '',
    vital_signs: '',
    labs_diagnostics: '',
    assessment_plan: '',
    followup_date: '',
    prescription: ''
  };
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
    current_medications: summary.current_medications?.trim() ?? '',
    vital_signs: summary.vital_signs?.trim() ?? '',
    labs_diagnostics: summary.labs_diagnostics?.trim() ?? '',
    assessment_plan: summary.assessment_plan?.trim() ?? '',
    followup_date: normalizeConsultationFollowupDate(summary.followup_date),
    prescription: summary.prescription?.trim() ?? ''
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
