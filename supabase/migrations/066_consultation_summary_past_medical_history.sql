-- Add optional doctor-entered past medical history to consultation summaries.

alter table public.consultation_summaries
  add column if not exists past_medical_history text;

comment on column public.consultation_summaries.past_medical_history is
  'Doctor-entered past medical history for the consultation summary.';
