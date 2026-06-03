import type { ConsultationSummary } from '../types/opinionRequest';

export const CONSULTATION_SUMMARY_FIELDS = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'history_present_illness', label: 'History of Present Illness' },
  { key: 'vital_signs', label: 'Vital Signs' },
  { key: 'current_medications', label: 'Current Medications' },
  { key: 'labs_diagnostics', label: 'Labs/Diagnostics' },
  { key: 'assessment_plan', label: 'Assessment & Plan' },
  { key: 'prescription', label: 'Prescription' }
] as const;

export type ConsultationSummaryFieldKey = (typeof CONSULTATION_SUMMARY_FIELDS)[number]['key'];

export type ConsultationSummaryFormValues = Record<ConsultationSummaryFieldKey, string>;

export function emptyConsultationSummaryValues(): ConsultationSummaryFormValues {
  return {
    chief_complaint: '',
    history_present_illness: '',
    vital_signs: '',
    current_medications: '',
    labs_diagnostics: '',
    assessment_plan: '',
    prescription: ''
  };
}

export function consultationSummaryToFormValues(
  summary: ConsultationSummary | null | undefined
): ConsultationSummaryFormValues {
  const empty = emptyConsultationSummaryValues();
  if (!summary) return empty;
  return {
    chief_complaint: summary.chief_complaint?.trim() ?? '',
    history_present_illness: summary.history_present_illness?.trim() ?? '',
    vital_signs: summary.vital_signs?.trim() ?? '',
    current_medications: summary.current_medications?.trim() ?? '',
    labs_diagnostics: summary.labs_diagnostics?.trim() ?? '',
    assessment_plan: summary.assessment_plan?.trim() ?? '',
    prescription: summary.prescription?.trim() ?? ''
  };
}

export function formatConsultationResponse(values: ConsultationSummaryFormValues): string {
  return CONSULTATION_SUMMARY_FIELDS.map(({ key, label }) => {
    const text = values[key].trim();
    return text ? `${label}:\n${text}` : null;
  })
    .filter(Boolean)
    .join('\n\n');
}
