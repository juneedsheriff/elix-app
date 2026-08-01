-- Optional doctor-entered follow-up date on consultation summaries.

alter table public.consultation_summaries
  add column if not exists followup_date date;

comment on column public.consultation_summaries.followup_date is
  'Doctor-entered follow-up date for the consultation summary.';
